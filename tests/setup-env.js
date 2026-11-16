// Must be imported FIRST by every test file: points the app at a separate test database.
process.env.NODE_ENV = 'test';
process.env.MONGODB_DB = process.env.MONGODB_TEST_DB || 'clinic_qms_test';
