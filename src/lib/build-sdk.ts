/**
 * The app consumes the standalone, zero-dependency SDK package that builders
 * install (`@bitmap/build-sdk`, source in `packages/bitmap-build-sdk`). This
 * module only re-exports it, so the marketplace and third-party builders are
 * guaranteed to share exactly one contract.
 */
export * from "../../packages/bitmap-build-sdk/src/index";
