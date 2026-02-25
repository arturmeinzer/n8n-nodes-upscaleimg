import type {
	IBinaryData,
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import FormData from 'form-data';
import { UpscaleImg } from '../../../nodes/UpscaleImg/UpscaleImg.node';

function getFormBodyStr(call: IHttpRequestOptions): string {
	return (call.body as FormData).getBuffer().toString('utf8');
}

// --- Shared test data ---

const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const API_RESPONSE = {
	original: {
		size: 8,
		width: 100,
		height: 100,
		mimeType: 'image/png',
		fileExt: 'png',
	},
	result: {
		size: 32,
		width: 200,
		height: 200,
		mimeType: 'image/webp',
		fileExt: 'webp',
		url: 'https://s3.example.com/upscaled.webp?signed=1',
	},
};

const DOWNLOADED_IMAGE = Buffer.from('fake-upscaled-image-data');

const MOCK_BINARY_OUTPUT: IBinaryData = {
	data: 'base64data',
	mimeType: 'image/webp',
	fileName: 'photo_upscaled.webp',
};

// --- Mock factory ---

interface MockParams {
	resizeMode?: string;
	scale?: number;
	customWidth?: number;
	customHeight?: number;
	objectFit?: string;
	binaryPropertyName?: string;
	options?: IDataObject;
}

interface MockOptions {
	params?: MockParams;
	continueOnFail?: boolean;
	items?: INodeExecutionData[];
	httpRequestFail?: boolean;
	assertBinaryDataFail?: boolean;
	binaryFileName?: string | undefined;
	binaryMimeType?: string | undefined;
}

function createMockExecuteFunctions(opts: MockOptions = {}): IExecuteFunctions {
	const {
		params = {},
		continueOnFail = false,
		items = [{ json: {}, binary: { data: { data: '', mimeType: 'image/png', fileName: 'photo.png' } } }],
		httpRequestFail = false,
		assertBinaryDataFail = false,
	} = opts;

	const hasBinaryFileName = 'binaryFileName' in opts;
	const hasBinaryMimeType = 'binaryMimeType' in opts;

	const defaults: MockParams = {
		binaryPropertyName: 'data',
		resizeMode: 'scale',
		scale: 2,
		options: {},
		...params,
	};

	const httpRequestCalls: IHttpRequestOptions[] = [];

	const mock = {
		getInputData: jest.fn(() => items),

		getNodeParameter: jest.fn((name: string, _i: number) => {
			return (defaults as Record<string, unknown>)[name];
		}),

		getCredentials: jest.fn(async (_name: string): Promise<ICredentialDataDecryptedObject> => ({
			apiKey: 'test-api-key-123',
		})),

		getNode: jest.fn(() => ({ name: 'UpscaleIMG' })),

		continueOnFail: jest.fn(() => continueOnFail),

		helpers: {
			assertBinaryData: jest.fn((_i: number, _name: string) => {
				if (assertBinaryDataFail) {
					throw new Error('No binary data found');
				}
				const result: Record<string, unknown> = {
					data: FAKE_PNG.toString('base64'),
				};
				if (hasBinaryMimeType) {
					result.mimeType = opts.binaryMimeType;
				} else {
					result.mimeType = 'image/png';
				}
				if (hasBinaryFileName) {
					result.fileName = opts.binaryFileName;
				} else {
					result.fileName = 'photo.png';
				}
				return result;
			}),

			getBinaryDataBuffer: jest.fn(async () => FAKE_PNG),

			httpRequest: jest.fn(async (options: IHttpRequestOptions) => {
				httpRequestCalls.push(options);

				if (httpRequestFail) {
					throw new Error('API request failed');
				}

				// First call = API upscale, second call = image download
				if (httpRequestCalls.length % 2 === 1) {
					return API_RESPONSE;
				}
				return DOWNLOADED_IMAGE;
			}),

			prepareBinaryData: jest.fn(async () => MOCK_BINARY_OUTPUT),
		},

		// Expose for assertions
		_httpRequestCalls: httpRequestCalls,
	};

	return mock as unknown as IExecuteFunctions;
}

// --- Tests ---

describe('UpscaleImg Node', () => {
	const node = new UpscaleImg();

	describe('description', () => {
		it('should have correct basic metadata', () => {
			expect(node.description.name).toBe('upscaleImg');
			expect(node.description.displayName).toBe('UpscaleIMG');
			expect(node.description.version).toBe(1);
			expect(node.description.group).toContain('transform');
		});

		it('should have dynamic subtitle for scale mode', () => {
			expect(node.description.subtitle).toContain('$parameter["resizeMode"]');
			expect(node.description.subtitle).toContain('Scale ');
			expect(node.description.subtitle).toContain('$parameter["scale"]');
		});

		it('should have dynamic subtitle for custom dimensions mode', () => {
			expect(node.description.subtitle).toContain('Custom ');
			expect(node.description.subtitle).toContain('$parameter["customWidth"]');
			expect(node.description.subtitle).toContain('$parameter["customHeight"]');
		});

		it('should require upscaleImgApi credentials', () => {
			expect(node.description.credentials).toEqual([
				{ name: 'upscaleImgApi', required: true },
			]);
		});

		it('should have main inputs and outputs', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should be usable as a tool', () => {
			expect(node.description.usableAsTool).toBe(true);
		});

		it('should define all expected properties', () => {
			const propNames = node.description.properties.map((p) => p.name);
			expect(propNames).toContain('binaryPropertyName');
			expect(propNames).toContain('resizeMode');
			expect(propNames).toContain('scale');
			expect(propNames).toContain('customWidth');
			expect(propNames).toContain('customHeight');
			expect(propNames).toContain('objectFit');
			expect(propNames).toContain('options');
		});

		it('should show scale only when resizeMode is scale', () => {
			const scaleProp = node.description.properties.find((p) => p.name === 'scale');
			expect(scaleProp?.displayOptions?.show?.resizeMode).toEqual(['scale']);
		});

		it('should show custom dimensions only when resizeMode is customDimensions', () => {
			const widthProp = node.description.properties.find((p) => p.name === 'customWidth');
			const heightProp = node.description.properties.find((p) => p.name === 'customHeight');
			const fitProp = node.description.properties.find((p) => p.name === 'objectFit');

			expect(widthProp?.displayOptions?.show?.resizeMode).toEqual(['customDimensions']);
			expect(heightProp?.displayOptions?.show?.resizeMode).toEqual(['customDimensions']);
			expect(fitProp?.displayOptions?.show?.resizeMode).toEqual(['customDimensions']);
		});
	});

	describe('execute', () => {
		it('should upscale with scale mode (2x)', async () => {
			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 2 },
			});

			const result = await node.execute.call(mock);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);

			const item = result[0][0];

			// Verify JSON output
			expect(item.json).toEqual({
				original: API_RESPONSE.original,
				result: {
					size: API_RESPONSE.result.size,
					width: API_RESPONSE.result.width,
					height: API_RESPONSE.result.height,
					mimeType: API_RESPONSE.result.mimeType,
					fileExt: API_RESPONSE.result.fileExt,
				},
			});

			// Verify binary output
			expect(item.binary?.data).toEqual(MOCK_BINARY_OUTPUT);

			// Verify pairedItem
			expect(item.pairedItem).toEqual({ item: 0 });

			// Verify API call
			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			expect(calls).toHaveLength(2);

			const apiCall = calls[0];
			expect(apiCall.method).toBe('POST');
			expect(apiCall.url).toBe('https://upscaleimg.app/api/v1/upscale');
			expect(apiCall.headers?.Authorization).toBe('Bearer test-api-key-123');

			// Verify multipart body contains scale=2
			const bodyStr = getFormBodyStr(apiCall);
			expect(bodyStr).toContain('name="image"');
			expect(bodyStr).toContain('name="scale"');
			expect(bodyStr).toContain('\r\n2\r\n');

			// Verify download call
			const downloadCall = calls[1];
			expect(downloadCall.method).toBe('GET');
			expect(downloadCall.url).toBe(API_RESPONSE.result.url);
			expect(downloadCall.encoding).toBe('arraybuffer');
		});

		it('should upscale with scale mode (4x)', async () => {
			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 4 },
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('name="scale"');
			expect(bodyStr).toContain('\r\n4\r\n');
		});

		it('should upscale with custom dimensions mode', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					resizeMode: 'customDimensions',
					customWidth: 3840,
					customHeight: 2160,
					objectFit: 'contain',
				},
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);

			expect(bodyStr).toContain('name="customWidth"');
			expect(bodyStr).toContain('\r\n3840\r\n');
			expect(bodyStr).toContain('name="customHeight"');
			expect(bodyStr).toContain('\r\n2160\r\n');
			expect(bodyStr).toContain('name="objectFit"');
			expect(bodyStr).toContain('\r\ncontain\r\n');
			expect(bodyStr).not.toContain('name="scale"');
		});

		it('should append outputFormat when set', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					resizeMode: 'scale',
					scale: 2,
					options: { outputFormat: 'webp' },
				},
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('name="outputFormat"');
			expect(bodyStr).toContain('\r\nwebp\r\n');
		});

		it('should send removeMetadata=1 when true', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					resizeMode: 'scale',
					scale: 2,
					options: { removeMetadata: true },
				},
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('name="removeMetadata"');
			expect(bodyStr).toContain('\r\n1\r\n');
		});

		it('should send removeMetadata=0 when false', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					resizeMode: 'scale',
					scale: 2,
					options: { removeMetadata: false },
				},
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('name="removeMetadata"');
			expect(bodyStr).toContain('\r\n0\r\n');
		});

		it('should use custom output binary field name', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					resizeMode: 'scale',
					scale: 2,
					options: { outputBinaryPropertyName: 'upscaledImage' },
				},
			});

			const result = await node.execute.call(mock);
			const item = result[0][0];

			expect(item.binary?.upscaledImage).toEqual(MOCK_BINARY_OUTPUT);
			expect(item.binary?.data).toBeUndefined();
		});

		it('should use default fileName when binary data has none', async () => {
			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 2 },
				binaryFileName: undefined,
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('filename="image.png"');

			expect(mock.helpers.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'image_upscaled.webp',
				'image/webp',
			);
		});

		it('should use default mimeType when binary data has none', async () => {
			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 2 },
				binaryMimeType: undefined,
			});

			await node.execute.call(mock);

			const calls = (mock as unknown as { _httpRequestCalls: IHttpRequestOptions[] })._httpRequestCalls;
			const bodyStr = getFormBodyStr(calls[0]);
			expect(bodyStr).toContain('Content-Type: image/png');
		});

		it('should generate correct output filename', async () => {
			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 2 },
			});

			await node.execute.call(mock);

			expect(mock.helpers.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'photo_upscaled.webp',
				'image/webp',
			);
		});

		it('should process multiple items with correct pairedItem', async () => {
			const items: INodeExecutionData[] = [
				{ json: {}, binary: { data: { data: '', mimeType: 'image/png', fileName: 'a.png' } } },
				{ json: {}, binary: { data: { data: '', mimeType: 'image/png', fileName: 'b.png' } } },
			];

			const mock = createMockExecuteFunctions({
				params: { resizeMode: 'scale', scale: 2 },
				items,
			});

			const result = await node.execute.call(mock);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
			expect(result[0][1].pairedItem).toEqual({ item: 1 });
		});

		describe('error handling', () => {
			it('should return error JSON when continueOnFail is true', async () => {
				const mock = createMockExecuteFunctions({
					continueOnFail: true,
					httpRequestFail: true,
				});

				const result = await node.execute.call(mock);

				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toEqual({
					error: 'API request failed',
				});
				expect(result[0][0].pairedItem).toEqual({ item: 0 });
			});

			it('should throw NodeOperationError when continueOnFail is false', async () => {
				const mock = createMockExecuteFunctions({
					continueOnFail: false,
					httpRequestFail: true,
				});

				await expect(node.execute.call(mock)).rejects.toThrow(NodeOperationError);
			});

			it('should handle missing binary data with continueOnFail', async () => {
				const mock = createMockExecuteFunctions({
					continueOnFail: true,
					assertBinaryDataFail: true,
				});

				const result = await node.execute.call(mock);

				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toEqual({
					error: 'No binary data found',
				});
			});
		});
	});
});
