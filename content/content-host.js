/**
 * @typedef { Object } ContentHostPort
 * @property {( path: string ) => Promise<void> } loadFile
 * @property {( navSnapshot: Object ) => Promise<void> } showCurrentContent
 */

/**
 * Owner of the #content element and all HTML-fragment injection.
 *
 * Planned interface:
 * - loadFile( path ): Promise<void>
 * - showCurrentContent( navSnapshot ): Promise<void>
 *
 * Every successful injection passes through applyEnhancers().
 */
