/**
 * @typedef { Object } NavSnapshot
 * @property { string } currentTop
 * @property { ReadonlyArray<string> } itemPath
 * @property { string | null } currentDetail
 */

/**
 * @typedef { Object } NavStatePort
 * @property {() => NavSnapshot } snapshot
 * @property {( listener: ( snapshot: NavSnapshot ) => void ) => (() => void) } subscribe
 * @property {() => void } goHome
 * @property {( top: string ) => void } selectSection
 * @property {( key: string ) => void } selectNode
 * @property {() => void } goUp
 * @property {( tabKey: string ) => void } selectDetail
 */

/**
 * Observer subject and sole owner of navigation state.
 *
 * A NavState exposes the current top-level section, item path, and detail tab,
 * accepts navigation commands, and returns an unsubscribe function from
 * subscribe( listener ). Construction-task state stays in task-nav.js.
 */
