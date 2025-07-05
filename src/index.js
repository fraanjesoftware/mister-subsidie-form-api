// Azure Functions v4 entry point
// This file ensures all functions are registered when the app starts

// Import all function files
require('./functions/fillForms');
require('./functions/createSigningSession');
require('./functions/docusignWebhook');
require('./functions/createDeMinimisSession');
require('./functions/createMKBSession');
require('./functions/createMachtigingSession');


// You can add more function imports here as you create them
// require('./functions/anotherFunction');