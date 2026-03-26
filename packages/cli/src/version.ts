import pkg from '../../npm-wrapper/package.json'

export const TGSM_VERSION = process.env.TGSM_VERSION ?? pkg.version
