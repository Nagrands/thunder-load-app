/**
 * @typedef {Object} QualitySelection
 * @property {"auto"|"best"|"audio"|"format"} mode
 * @property {string=} formatId
 * @property {string=} videoFormatId
 * @property {string=} audioFormatId
 */

/**
 * @typedef {Object} TrackV3
 * @property {string} id
 * @property {"local"|"youtube"|"network"} providerId
 * @property {string} sourceRef
 * @property {string} title
 * @property {string} displayTitle
 * @property {string} artist
 * @property {string} album
 * @property {number} duration
 * @property {number} sizeBytes
 * @property {"audio"|"video"} kind
 * @property {"available"|"missing"} availability
 * @property {string} artworkUrl
 * @property {string} mimeType
 * @property {QualitySelection|null} qualitySelection
 */

/**
 * @typedef {Object} QualityOption
 * @property {string} id
 * @property {string} label
 * @property {QualitySelection} selector
 * @property {number=} width
 * @property {number=} height
 * @property {number=} fps
 * @property {string=} container
 * @property {string=} videoCodec
 * @property {string=} audioCodec
 * @property {number=} bitrateKbps
 * @property {number=} sizeBytes
 */

/**
 * @typedef {Object} PlaybackDescriptor
 * @property {"direct"|"hls"=} kind
 * @property {string} src
 * @property {string=} mimeType
 * @property {string=} posterUrl
 * @property {string=} sessionId
 */

/**
 * @typedef {Object} QueueItem
 * @property {string} id
 * @property {TrackV3} track
 * @property {number} addedAt
 */

/**
 * @typedef {Object} MediaSnapshot
 * @property {{title: string, artist?: string, artworkUrl?: string}|null} track
 * @property {boolean} isPlaying
 * @property {number=} duration
 * @property {number=} position
 * @property {boolean} canNext
 * @property {boolean} canPrevious
 */

export {};
