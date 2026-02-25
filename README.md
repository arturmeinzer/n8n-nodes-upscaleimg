# n8n-nodes-upscaleimg

This is an n8n community node that lets you upscale images using the [UpscaleIMG](https://upscaleimg.app) API.

UpscaleIMG uses AI to upscale images by 2x or 4x, or to custom dimensions.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Credentials

You need an UpscaleIMG API key. Get one at [upscaleimg.app/en/api-docs](https://upscaleimg.app/en/api-docs).

Add the API key in n8n under **Credentials > UpscaleIMG API**.

## Operations

### Upscale Image

Upscale an image from a binary input.

**Resize Modes:**

- **Scale** — Upscale by 2x or 4x (4x requires an active subscription)
- **Custom Dimensions** — Specify exact width and height with an object-fit mode (cover, contain, fill)

**Options:**

- **Output Format** — PNG, JPEG, or WebP
- **Remove Metadata** — Strip EXIF data from the output
- **Output Binary Field** — Name of the binary property for the result (default: `data`)

## Compatibility

Tested with n8n version 1.0+.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [UpscaleIMG API documentation](https://upscaleimg.app/en/api-docs)
