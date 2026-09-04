import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import { chromium } from "playwright-core";

const PROJECT_ROOT = fileURLToPath( new URL( "../", import.meta.url ) );
const LINUX_PROJECT_ROOT = "/home/adamsl/agent_blocks/spa_documentation";
const IS_WINDOWS = process.platform === "win32";
const SHOW_BROWSER = process.env.SPA_TEST_HEADED === "1";
const SLOW_MO = Number.parseInt( process.env.SPA_TEST_SLOW_MO ?? "0", 10 );
const HOLD_OPEN_MS = Number.parseInt( process.env.SPA_TEST_HOLD_OPEN_MS ?? "0", 10 );
const HOME_NAV_LABELS = [
    "Home",
    "Claude Agent Adapter",
    "Catherine Agent",
    "Lancedb Memory",
    "Voice Communication",
    "Mazda",
    "Solid Agent Systems",
];
const DETAIL_NAV_LABELS = [
    "Back",
    "Source",
    "Class Diagram",
    "Sequence Diagram",
    "Construction Status",
    "Update Documentation",
];
const DETAIL_TABS = [
    [ "Source", "basic_agent.py.html" ],
    [ "Class Diagram", "mermaid_class.html" ],
    [ "Sequence Diagram", "mermaid_sequence.html" ],
    [ "Construction Status", "basic_agent_construction_status.html" ],
    [ "Update Documentation", "basic_agent_update_documentation.html" ],
];

let baseUrl;
let browser;
let serverProcess;

async function reservePort() {
    const server = createServer();
    await new Promise( ( resolve, reject ) => {
        server.once( "error", reject );
        server.listen( 0, "127.0.0.1", resolve );
    });
    const address = server.address();
    assert.ok( address && typeof address !== "string" );
    const { port } = address;
    await new Promise( ( resolve, reject ) => {
        server.close( ( error ) => error ? reject( error ) : resolve());
    });
    return port;
}

async function waitForServer( url ) {
    for ( let attempt = 0; attempt < 50; attempt += 1 ) {
        try {
            const response = await fetch( url );
            if ( response.ok ) return;
        } catch {
            // The child process may still be binding its socket.
        }
        await new Promise( ( resolve ) => setTimeout( resolve, 100 ) );
    }
    throw new Error( `SPA server did not become ready at ${url}` );
}

async function navLabels( page ) {
    return page.locator( "#nav a" ).allTextContents();
}

async function createPage() {
    const page = await browser.newPage();
    if ( SHOW_BROWSER ) await page.bringToFront();
    return page;
}

function focusWindowsChrome() {
    if ( !SHOW_BROWSER || !IS_WINDOWS ) return;
    const script = [
        "$chrome = Get-Process chrome |",
        "Where-Object { $_.MainWindowTitle -like 'Agent Blocks Docs*' } |",
        "Select-Object -First 1;",
        "if ($chrome) {",
        "(New-Object -ComObject WScript.Shell).AppActivate($chrome.Id) | Out-Null",
        "}",
    ].join( " " );
    spawnSync( "powershell.exe", [ "-NoProfile", "-Command", script ], {
        stdio: "ignore",
    });
}

async function waitForNav( page, expected ) {
    await page.waitForFunction( ( labels ) => {
        const actual = Array.from(
            document.querySelectorAll( "#nav a" ),
            ( link ) => link.textContent?.trim() ?? "",
        );
        return JSON.stringify( actual ) === JSON.stringify( labels );
    }, expected );
    assert.deepEqual( await navLabels( page ), expected );
}

async function openConversationStatus( page ) {
    await page.goto(
        `${baseUrl}/index.html#item=voice_communication/conversation_agent&tab=status`,
    );
    await page.getByRole( "link", { name: "1. Declare the Plug-in Point", exact: true }).waitFor();
}

describe( "legacy SPA navigation characterization", { concurrency: false }, () => {
    before( async () => {
        const port = await reservePort();
        baseUrl = `http://127.0.0.1:${port}`;
        serverProcess = IS_WINDOWS
            ? spawn( "wsl.exe", [
                "-d",
                "Ubuntu-26.04",
                "--cd",
                LINUX_PROJECT_ROOT,
                "python3",
                "server.py",
                String( port ),
            ], { stdio: "ignore" })
            : spawn( "python3", [ "server.py", String( port ) ], {
                cwd: PROJECT_ROOT,
                stdio: "ignore",
            });
        await waitForServer( `${baseUrl}/index.html` );
        browser = await chromium.launch( {
            executablePath: IS_WINDOWS
                ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                : "/usr/bin/google-chrome",
            headless: !SHOW_BROWSER,
            slowMo: SLOW_MO,
            args: [
                "--no-sandbox",
                ...( SHOW_BROWSER
                    ? [ "--window-position=50,50", "--window-size=1280,800" ]
                    : [] ),
            ],
        });
    });

    after( async () => {
        if ( SHOW_BROWSER && HOLD_OPEN_MS > 0 && browser ) {
            const page = await createPage();
            await page.goto( `${baseUrl}/index.html` );
            await page.evaluate( ( holdOpenMs ) => {
                const banner = document.createElement( "div" );
                banner.textContent = `Browser test run finished. Closing in ${holdOpenMs / 1000} seconds…`;
                Object.assign( banner.style, {
                    background: "#17365d",
                    color: "white",
                    font: "600 20px system-ui",
                    left: "0",
                    padding: "18px 24px",
                    position: "fixed",
                    right: "0",
                    textAlign: "center",
                    top: "0",
                    zIndex: "99999",
                });
                document.body.appendChild( banner );
            }, HOLD_OPEN_MS );
            focusWindowsChrome();
            await new Promise( ( resolve ) => setTimeout( resolve, HOLD_OPEN_MS ) );
        }
        await browser?.close();
        serverProcess?.kill( "SIGTERM" );
    });

    test( "renders the established home navigation in order", async () => {
        const page = await createPage();
        try {
            await page.goto( `${baseUrl}/index.html` );
            await waitForNav( page, HOME_NAV_LABELS );
            await page.locator( "#nav a.active", { hasText: "Home" }).waitFor();
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await page.close();
        }
    });

    test( "drills down to a leaf and preserves all five detail tabs", async () => {
        const page = await createPage();
        try {
            await page.goto( `${baseUrl}/index.html` );
            await page.getByRole( "link", { name: "Catherine Agent", exact: true }).click();
            await page.getByRole( "link", { name: "Basic Agent", exact: true }).click();
            await waitForNav( page, DETAIL_NAV_LABELS );

            for ( const [ label, fileName ] of DETAIL_TABS ) {
                const responsePromise = page.waitForResponse( ( response ) =>
                    response.url().endsWith( `/catherine_agent_sdk/basic_agent/${fileName}` ),
                );
                await page.getByRole( "link", { name: label, exact: true }).click();
                assert.equal( ( await responsePromise ).status(), 200 );
                await page.locator( "#nav a.active", { hasText: label }).waitFor();
                assert.deepEqual( await navLabels( page ), DETAIL_NAV_LABELS );
                assert.notEqual( await page.locator( "#content" ).innerHTML(), "" );
            }

            await page.locator( "#content .update-doc-bar" ).waitFor();
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await page.close();
        }
    });

    test( "applies a deep-linked tab and scrolls to its anchor", async () => {
        const context = await browser.newContext();
        await context.addInitScript( () => {
            window.__lastScrolledId = null;
            Element.prototype.scrollIntoView = function scrollIntoView() {
                window.__lastScrolledId = this.id || null;
            };
        });
        const page = await context.newPage();
        if ( SHOW_BROWSER ) await page.bringToFront();
        try {
            await page.goto(
                `${baseUrl}/index.html#item=voice_communication/conversation_agent&tab=status&anchor=next-steps`,
            );
            await page.waitForFunction( () => window.__lastScrolledId === "next-steps" );
            await page.locator( "#content #next-steps" ).waitFor();
            await page.getByRole( "link", { name: "1. Declare the Plug-in Point", exact: true }).waitFor();
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await context.close();
        }
    });

    test( "falls back to Home for an unknown deep link", async () => {
        const page = await createPage();
        try {
            await page.goto( `${baseUrl}/index.html#item=missing/not_real&tab=source` );
            await waitForNav( page, HOME_NAV_LABELS );
            await page.locator( "#nav a.active", { hasText: "Home" }).waitFor();
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await page.close();
        }
    });

    test( "hides the in-page header in embedded mode", async () => {
        const page = await createPage();
        try {
            await page.goto( `${baseUrl}/index.html?embedded=1` );
            assert.equal( await page.locator( "body" ).getAttribute( "class" ), "embedded" );
            assert.equal(
                await page.locator( "header" ).evaluate( ( header ) => getComputedStyle( header ).display ),
                "none",
            );
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await page.close();
        }
    });

    test( "drills into both embedded lessons and backs out one level at a time", async () => {
        const page = await createPage();
        try {
            await openConversationStatus( page );
            await page.getByRole( "link", { name: "1. Declare the Plug-in Point", exact: true }).click();

            for ( const lesson of [
                [ "Interface File", "Interface File Construction Status" ],
                [ "Event Contracts", "Event Contracts Construction Status" ],
            ]) {
                const [ navLabel, heading ] = lesson;
                await page.getByRole( "link", { name: navLabel, exact: true }).click();
                await page.getByRole( "heading", { name: heading, exact: true }).waitFor();
                await page.waitForFunction( () =>
                    document.querySelectorAll( "#content .construction-task-focus svg" ).length === 2,
                );
                assert.equal(
                    await page.locator( "#content [data-open-project-terminal]" )
                        .getAttribute( "data-project-terminal-wired" ),
                    "true",
                );
                assert.equal(
                    await page.locator( "#content [data-run-test-suite]" )
                        .getAttribute( "data-run-tests-wired" ),
                    "true",
                );
            }

            await page.getByRole( "link", { name: "Back", exact: true }).click();
            await page.getByRole( "link", { name: "2. Prove With One Adapter", exact: true }).waitFor();
            await page.getByRole( "link", { name: "Back", exact: true }).click();
            await waitForNav( page, DETAIL_NAV_LABELS );
        } finally {
            await page.evaluate( () => alert( "OK" ) );
            await page.close();
        }
    });
});
