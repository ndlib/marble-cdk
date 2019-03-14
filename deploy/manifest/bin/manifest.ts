#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { ManifestStack } from '../lib/manifest-stack';
// import { Stack } from '@aws-cdk/cdk';

const app = new cdk.App();
new ManifestStack(app, 'ManifestStack');
app.run();
