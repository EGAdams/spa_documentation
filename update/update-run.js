/**
 * @typedef { Object } UpdateRunPort
 * @property {( itemKey: string ) => Promise<Object> } start
 * @property {( itemKey: string ) => Promise<Object> } poll
 */

/**
 * Documentation-update run state machine.
 *
 * Planned interface:
 * - start( itemKey ): Promise<UpdateRun>
 * - poll( itemKey ): Promise<UpdateRun>
 */
