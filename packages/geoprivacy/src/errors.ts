export class GeoPrivacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoPrivacyError';
  }
}

export class GeoPrivacyViolation extends GeoPrivacyError {
  constructor(message: string) {
    super(message);
    this.name = 'GeoPrivacyViolation';
  }
}
