import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import FormData from 'form-data';

export class UpscaleImg implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'UpscaleIMG',
		name: 'upscaleImg',
		icon: 'file:upscaleimg.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resizeMode"] === "scale" ? "Scale " + $parameter["scale"] + "x" : "Custom " + $parameter["customWidth"] + "x" + $parameter["customHeight"]}}',
		description: 'Upscale images using the UpscaleIMG API',
		defaults: {
			name: 'UpscaleIMG',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'upscaleImgApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the image to upscale',
			},
			{
				displayName: 'Resize Mode',
				name: 'resizeMode',
				type: 'options',
				options: [
					{
						name: 'Scale',
						value: 'scale',
						description: 'Upscale by a fixed factor (2x or 4x)',
					},
					{
						name: 'Custom Dimensions',
						value: 'customDimensions',
						description: 'Specify exact output width and height',
					},
				],
				default: 'scale',
				description: 'How to determine the output image size',
			},
			{
				displayName: 'Scale Factor',
				name: 'scale',
				type: 'options',
				options: [
					{ name: '2x', value: 2 },
					{ name: '4x', value: 4 },
				],
				default: 2,
				description: 'Factor to upscale the image by',
				displayOptions: {
					show: {
						resizeMode: ['scale'],
					},
				},
			},
			{
				displayName: 'Width',
				name: 'customWidth',
				type: 'number',
				default: 1920,
				required: true,
				description: 'Target output width in pixels',
				displayOptions: {
					show: {
						resizeMode: ['customDimensions'],
					},
				},
				typeOptions: {
					minValue: 1,
				},
			},
			{
				displayName: 'Height',
				name: 'customHeight',
				type: 'number',
				default: 1080,
				required: true,
				description: 'Target output height in pixels',
				displayOptions: {
					show: {
						resizeMode: ['customDimensions'],
					},
				},
				typeOptions: {
					minValue: 1,
				},
			},
			{
				displayName: 'Object Fit',
				name: 'objectFit',
				type: 'options',
				options: [
					{
						name: 'Cover',
						value: 'cover',
						description: 'Crop to fill dimensions',
					},
					{
						name: 'Contain',
						value: 'contain',
						description: 'Fit within dimensions, may letterbox',
					},
					{
						name: 'Fill',
						value: 'fill',
						description: 'Stretch to fill dimensions exactly',
					},
				],
				default: 'cover',
				description: 'How to fit the image into the target dimensions',
				displayOptions: {
					show: {
						resizeMode: ['customDimensions'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [
							{ name: 'PNG', value: 'png' },
							{ name: 'JPEG', value: 'jpg' },
							{ name: 'WebP', value: 'webp' },
						],
						default: 'png',
						description: 'Format of the output image',
					},
					{
						displayName: 'Remove Metadata',
						name: 'removeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to strip EXIF and other metadata from the output image',
					},
					{
						displayName: 'Output Binary Field',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property to store the upscaled image',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
				const resizeMode = this.getNodeParameter('resizeMode', i) as string;
				const options = this.getNodeParameter('options', i) as IDataObject;

				const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
				const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

				const fileName = binaryData.fileName || 'image.png';
				const mimeType = binaryData.mimeType || 'image/png';

				const credentials = await this.getCredentials('upscaleImgApi');
				const apiKey = credentials.apiKey as string;

				const form = new FormData();
				form.append('image', binaryBuffer, { filename: fileName, contentType: mimeType });

				if (resizeMode === 'scale') {
					const scale = this.getNodeParameter('scale', i) as number;
					form.append('scale', String(scale));
				} else {
					const customWidth = this.getNodeParameter('customWidth', i) as number;
					const customHeight = this.getNodeParameter('customHeight', i) as number;
					const objectFit = this.getNodeParameter('objectFit', i) as string;
					form.append('customWidth', String(customWidth));
					form.append('customHeight', String(customHeight));
					form.append('objectFit', objectFit);
				}

				if (options.outputFormat) {
					form.append('outputFormat', options.outputFormat as string);
				}
				if (options.removeMetadata !== undefined) {
					form.append('removeMetadata', (options.removeMetadata as boolean) ? '1' : '0');
				}

				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: 'https://upscaleimg.app/api/v1/upscale',
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
					body: form,
				};

				const response = (await this.helpers.httpRequest(requestOptions)) as {
					original: {
						size: number;
						width: number;
						height: number;
						mimeType: string;
						fileExt: string;
					};
					result: {
						size: number;
						width: number;
						height: number;
						mimeType: string;
						fileExt: string;
						url: string;
					};
				};

				// Download the upscaled image from the signed URL
				const downloadOptions: IHttpRequestOptions = {
					method: 'GET',
					url: response.result.url,
					encoding: 'arraybuffer',
				};

				const imageArrayBuffer = await this.helpers.httpRequest(downloadOptions);
				const imageBuffer = Buffer.from(imageArrayBuffer as ArrayBuffer);

				const outputBinaryPropertyName =
					(options.outputBinaryPropertyName as string) || 'data';
				const baseName = fileName.replace(/\.[^.]+$/, '');
				const outputFileName = `${baseName}_upscaled.${response.result.fileExt}`;

				const binaryOutput = await this.helpers.prepareBinaryData(
					imageBuffer,
					outputFileName,
					response.result.mimeType,
				);

				returnData.push({
					json: {
						original: response.original,
						result: {
							size: response.result.size,
							width: response.result.width,
							height: response.result.height,
							mimeType: response.result.mimeType,
							fileExt: response.result.fileExt,
						},
					},
					binary: {
						[outputBinaryPropertyName]: binaryOutput,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
