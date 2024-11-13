#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createAdapter } from './adapters/index.mjs';

const commander = new Command();

const handleSync = async (sourceURI: string, destinationURI: string) => {
    try {
        // console.log(chalk.green(`Syncing data from ${sourceURI} to ${destinationURI}`));

        const sourceAdapter = createAdapter(sourceURI);

        await sourceAdapter.connect();

        await sourceAdapter.getData();

        process.exit(0);
    } catch (error) {
        console.error(chalk.red(error));
        process.exit(1);
    }
};

const handleListAdapters = () => {
    console.log('');
    console.log(chalk.grey('Listing available adapters:'));
    console.log(chalk.green('1. Postgres'));
    console.log(chalk.green('2. MongoDB'));
    console.log('');
};

commander
    .version('1.0.0')
    .description('Syncron is a command-line tool for synchronizing data between different databases');

commander
    .command('sync <sourceURI> <destinationURI>')
    .description('Sync data from a source URI to a destination URI')
    .action(handleSync);

commander
    .command('list-adapters')
    .description('List available adapters')
    .action(handleListAdapters);

commander.parse(process.argv);