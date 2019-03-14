import { ManifestStack } from '../../lib/manifest-stack';
import cdk = require('@aws-cdk/cdk');
import { expect, haveResource } from '@aws-cdk/assert';
import 'mocha';

const stack = new cdk.App();
const Manifest = new ManifestStack(stack,'ManifestStack',{
});

describe('Synthesized CFN Template', () => {

  it('Should have an S3 Bucket with Versioning Enabled', () => {
  expect(Manifest).to(haveResource("AWS::S3::Bucket", {
     VersioningConfiguration: {
    "Status": "Enabled"
  }}
  ))
  });

});




