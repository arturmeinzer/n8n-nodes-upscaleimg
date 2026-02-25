import { UpscaleImgApi } from '../../credentials/UpscaleImgApi.credentials';

describe('UpscaleImgApi Credentials', () => {
	const credential = new UpscaleImgApi();

	it('should have correct name and display name', () => {
		expect(credential.name).toBe('upscaleImgApi');
		expect(credential.displayName).toBe('UpscaleIMG API');
	});

	it('should link to the correct documentation URL', () => {
		expect(credential.documentationUrl).toBe('https://upscaleimg.app/en/api-docs');
	});

	it('should have a single apiKey property', () => {
		expect(credential.properties).toHaveLength(1);

		const apiKeyProp = credential.properties[0];
		expect(apiKeyProp.name).toBe('apiKey');
		expect(apiKeyProp.type).toBe('string');
		expect(apiKeyProp.required).toBe(true);
		expect(apiKeyProp.typeOptions).toEqual({ password: true });
	});

	it('should authenticate with Bearer token in Authorization header', () => {
		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: {
				headers: {
					Authorization: '=Bearer {{$credentials.apiKey}}',
				},
			},
		});
	});
});
