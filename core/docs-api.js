/**
 * @typedef { Object } SourceStatus
 * @property { boolean } exists
 * @property { boolean } dirty
 */

/**
 * @typedef { Object } DocsApiPort
 * @property {( apiPath: string ) => Promise<unknown> } runTestSuite
 * @property {( apiPath: string ) => Promise<unknown> } openProjectTerminal
 * @property {( sourceUrl: string ) => Promise<string> } fetchLesson
 * @property {( path: string ) => Promise<string> } fetchFragment
 * @property {( path: string ) => Promise<string> } fetchOverview
 * @property {( itemKey: string ) => Promise<SourceStatus> } gitStatus
 * @property {( itemKey: string ) => Promise<unknown> } startUpdate
 * @property {( itemKey: string ) => Promise<unknown> } updateStatus
 */

/**
 * Server facade. This will be the only application module allowed to call fetch().
 * All API paths remain relative so reverse-proxy hosting keeps working.
 *
 * Planned exports:
 * - UNKNOWN_STATUS
 * - DocsApi.fetchFragment( path )
 * - DocsApi.fetchOverview( path )
 * - DocsApi.fetchLesson( sourceUrl )
 * - DocsApi.gitStatus( itemKey )
 * - DocsApi.startUpdate( itemKey )
 * - DocsApi.updateStatus( itemKey )
 * - DocsApi.runTestSuite( apiPath )
 * - DocsApi.openProjectTerminal( apiPath )
 */
