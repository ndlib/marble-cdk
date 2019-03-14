import { ManifestStack } from '../../lib/manifest-stack';
import cdk = require('@aws-cdk/cdk');
import { expect, haveResource } from '@aws-cdk/assert';
import 'mocha';

const stack = new cdk.App();

const Manifest = new ManifestStack(stack,"ManifestStack", {
    
} );
describe('Synthesized CFN Template', () => {

  it('Should have an IAM Role for CodeBuild to use', () => {
expect(Manifest).to(haveResource('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": {
                "Fn::Join": [
                  "",
                  [
                    "codebuild.",
                    {
                      "Ref": "AWS::URLSuffix"
                    }
                  ]
                ]
              }
            }
          }
        ],
        "Version": "2012-10-17"
      }
}))}),
it('Should have an IAM Role for CodePipeline to use', () => {
  expect(Manifest).to(haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": {
                  "Fn::Join": [
                    "",
                    [
                      "codepipeline.",
                      {
                        "Ref": "AWS::URLSuffix"
                      }
                    ]
                  ]
                }
              }
            }
          ],
          "Version": "2012-10-17"
        }
  }))}),
  it('Should have an IAM Role for CloudFormation to use', () => {
    expect(Manifest).to(haveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
            "Statement": [
              {
                "Action": "sts:AssumeRole",
                "Effect": "Allow",
                "Principal": {
                  "Service": {
                    "Fn::Join": [
                      "",
                      [
                        "cloudformation.",
                        {
                          "Ref": "AWS::URLSuffix"
                        }
                      ]
                    ]
                  }
                }
              }
            ],
            "Version": "2012-10-17"
          }
    }))}),
    it('Should not have any IAM Policies that are */*', () => {
      expect(Manifest).notTo(haveResource('AWS::IAM::Policy', {
          PolicyDocument: {
              "Statement": [
                {
                  "Action": "*",
                  "Resource": "*",
                  "Effect": "Allow",
                }
              ],
              "Version": "2012-10-17"
            }
      }))})},)