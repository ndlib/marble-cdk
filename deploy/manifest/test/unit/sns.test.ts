import { ManifestStack } from '../../lib/manifest-stack';
import cdk = require('@aws-cdk/cdk');
import { expect, haveResource } from '@aws-cdk/assert';
import 'mocha';

const stack = new cdk.App();
const Manifest = new ManifestStack(stack,"Stack",{
});

describe('Synthesized CFN Template', () => {

  it('Should have an SNS Topic with \'PipelineEventsTopic\' as the Display Name', () => {
  expect(Manifest).to(haveResource("AWS::SNS::Topic",{
   DisplayName: "PipelineEventsTopic"}
  ))
  });

});




