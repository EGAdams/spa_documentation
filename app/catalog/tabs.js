/**
 * @typedef { Object } DetailTabStrategy
 * @property { string } key
 * @property { string } label
 * @property { string } file
 * @property {( host: Element, navState: Object ) => void | Promise<void> } afterLoad
 * @property {( navState: Object ) => Object | null } navContribution
 */

/**
 * Detail-tab catalog and Strategy boundary.
 *
 * Planned exports:
 * - overviewFile
 * - DOC_ROOT
 * - detailTabs
 *
 * Each eventual tab Strategy owns its key, label, filename, after-load hook,
 * and navigation contribution.
 */
