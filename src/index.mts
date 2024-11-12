#!/usr/bin/env node

const [sourceURI, destinationURI] = process.argv.slice(2);

if (!sourceURI || !destinationURI) {
    console.error('Error: Both source and destination database connection URIs must be provided.\n');
    console.log(`Usage: syncron <source-uri> <destination-uri>`);

    process.exit(1);
}

console.log({ sourceURI, destinationURI });