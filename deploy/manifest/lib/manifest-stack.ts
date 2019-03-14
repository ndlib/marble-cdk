import cdk = require('@aws-cdk/cdk');
import sns = require('@aws-cdk/aws-sns');
import codebuild = require('@aws-cdk/aws-codebuild');
import { Fn, CfnParameter, RemovalPolicy } from '@aws-cdk/cdk';
import { Role, ServicePrincipal, PolicyStatement } from '@aws-cdk/aws-iam';
import codepipeline = require('@aws-cdk/aws-codepipeline');
import cfn = require('@aws-cdk/aws-cloudformation');
import { Bucket } from '@aws-cdk/aws-s3';
import readlineSync = require('readline-sync');
import { LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { CloudFormationCapabilities } from '@aws-cdk/aws-cloudformation';

export class ManifestStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // Let's define parameters first
    // const GitHubToken = new cdk.Token(readlineSync.question('What is the value of the oAuth Token for the GitHub user? ', {hideEchoBack: true}));
    const oAuth = new CfnParameter(this, 'GitHubToken', {
      type: "String", noEcho: true, default: "marble", description: 'Secret. OAuthToken with access to Repo. Long string of characters and digits. Go to https://github.com/settings/tokens'
    });

    oAuth.stringValue = readlineSync.question('What is the value of the oAuth Token for the GitHub user? ', {hideEchoBack: true});
    
    const InfrastructureStackName = new cdk.Token(readlineSync.question('Infrastructure Stack Name? (default: marble-app-infrastructure) ', { 
      defaultInput: "marble-app-infrastructure" }));
    new CfnParameter(this, 'InfrastructureStackName', {
      type: "String", default: InfrastructureStackName, description: "The name of the parent infrastructure/networking stack that you created. Necessary to locate and reference resources created by that stack."
    });

    const DomainStackName = new cdk.Token(readlineSync.question('Domain Stack Name? (default: marble-domain) ', {
      defaultInput: "marble-domain" }));
    new CfnParameter(this, 'DomainStackName', {
      type: "String", default: DomainStackName, description: "The name of the parent domain stack that you created. Necessary to locate and reference resources created by that stack."
    });

    const ProdStackName = new cdk.Token(readlineSync.question('What would you like to name the Production Manifest Pipeline Stack? (default: marble-manifest-prod) ', {
      defaultInput: "marble-manifest-prod" }));
    new CfnParameter(this, 'ProdStackName', {
      type: "String", maxLength: 24, default: ProdStackName, description: "The name of the CloudFormation stack to use when creating the production resources"
    });
    
    const ProdHostnamePrefix = new cdk.Token(readlineSync.question('What\'s the name of the Production Hostname Prefix? '));
    new CfnParameter(this, 'ProdHostnamePrefix', {
      type: "String", maxLength: 63, default: ProdHostnamePrefix,allowedPattern: '^$|(?!-)[a-zA-Z0-9-.]{1,63}(?<!-)', constraintDescription: "Must be a valid hostname prefix.", description: "Hostname prefix for the production manifest bucket CDN."
    });

    const TestStackName = new cdk.Token(readlineSync.question('What would you like to name the Test Manifest Pipeline Stack? (default: marble-manifest-test) ', {
      defaultInput: "marble-manifest-test" }));
    new CfnParameter(this, 'TestStackName', {
      type: "String", maxLength: 24, default: TestStackName, description: "The name of the CloudFormation stack to use when creating the test resources"
    });

    const TestHostnamePrefix = new cdk.Token(readlineSync.question('What\'s the name of the Test Hostname Prefix? '));
    new CfnParameter(this, 'TestHostnamePrefix', {
      type: "String", maxLength: 63, default: TestHostnamePrefix, allowedPattern: '^$|(?!-)[a-zA-Z0-9-.]{1,63}(?<!-)', constraintDescription: "Must be a valid hostname prefix.", description: "Hostname prefix for the test manifest bucket CDN."
    });

    const CreateDNSRecord = new cdk.Token(readlineSync.question('I want to create DNS Records for the Manifest Pipelines [True/False] (default: True) ', {
      defaultInput: "True" }));
    new CfnParameter(this, 'CreateDNSRecord', {
      type: "String", default: CreateDNSRecord, description: "If True, will attempt to create a Route 53 DNS record for the test and prod stacks."
    });

    const Receivers = new cdk.Token(readlineSync.questionEMail('What e-mail would you like to use for approval of deployments? '));
    new CfnParameter(this, 'Receivers', {
      type: "String", default: Receivers, description: "An e-mail address to send the monitoring notifications"
    });

    const ConfigurationRepoName = new cdk.Token(readlineSync.question('What is the name of the GitHub repository that has the CloudFormation \"Blueprints\"? (default: mellon-blueprints) ', {
      defaultInput: "mellon-blueprints"
    }));
    new CfnParameter(this, 'ConfigurationRepoName', {
      type: "String", default: ConfigurationRepoName, description: "The GitHub repo for the cloudfromation blueprints"
    });

    const ConfigurationRepoBranchName = new cdk.Token(readlineSync.question('Which branch do you want to build the \"Blueprints\" from? (default: master) ', {
      defaultInput: "master"
    }));
    new CfnParameter(this, 'ConfigurationRepoBranchName', {
      type: "String", default: ConfigurationRepoBranchName, description: "The GitHub repo branch the codepipeline should checkout to run blueprints from"
    });

    const ManifestPipelineRepoName = new cdk.Token(readlineSync.question('What is the name of the GitHub repository that has the Manifest Pipeline code? (default: mellon-manifest-pipeline) ', {
      defaultInput: "mellon-manifest-pipeline"
    }));
    new CfnParameter(this, 'ManifestPipelineRepoName', {
      type: "String", default: ManifestPipelineRepoName, description: "The GitHub repo branch the codepipeline should checkout to run blueprints from"
    });

    const ManifestPipelineRepoBranch = new cdk.Token(readlineSync.question('Which branch do you want to build the Manifest Pipeline from? (default: master) ', {
      defaultInput: "master"
    }));
    new CfnParameter(this, 'ManifestPipelineRepoBranch', {
      type: "String", default: ManifestPipelineRepoBranch, description: "The GitHub repo branch the codepipeline should checkout to run blueprints from"
    });

    const GitHubUser = new cdk.Token(readlineSync.question('What is the owner name with which you would like to use to access GitHub? (default: ndlib) ', {
      defaultInput: "ndlib"
    }));
    new CfnParameter(this, 'GitHubUser', {
      type: "String", default: GitHubUser, description: "GitHub UserName. This username must have access to the GitHubToken."
    });

    const ImageServiceTestStackName = new cdk.Token(readlineSync.question('What is the name of the IIIF Image Service Test Stack? (default: marble-image-service-test) ', {
      defaultInput: "marble-image-service-test"}));
    new CfnParameter(this, 'ImageServiceTestStackName', {
      type: "String", default: ImageServiceTestStackName, description: "The name of the test IIIF image service stack."
    });
    
    const ImageServiceProdStackName = new cdk.Token(readlineSync.question('What is the name of the IIIF Image Service Production Stack? (default: marble-image-service) ', {
      defaultInput: "marble-image-service" }));
    new CfnParameter(this, 'ImageServiceProdStackName', {
      type: "String", default: ImageServiceProdStackName, description: "The name of the production IIIF image service stack."
    }); 

    const DataBrokerStackName = new cdk.Token(readlineSync.question('What is the name of the shared Data Broker stack? (default: marble-data-broker) ', {
      defaultInput: "marble-data-broker"
    }));
    new CfnParameter(this, 'DataBrokerStackName', {
      type: "String", default: DataBrokerStackName, description: "The name of the test IIIF image service stack."
    });

    const AppConfigPathProd = new cdk.Token(readlineSync.question('What is the SSM Path where configuration data should be read from and written to for production? (default: /all/marble-manifest-pipeline) ', {
      defaultInput: "/all/marble-manifest-pipeline"}));
    new CfnParameter(this, 'AppConfigPathProd', {
      type: "String", default: AppConfigPathProd, description: "The path the keys for parameter store should be read and written to for config."
    });

    const AppConfigPathTest = new cdk.Token(readlineSync.question('What is the SSM Path where configuration data should be read from and written to for test? (default: /all/marble-manifest-pipeline-test) ', {
      defaultInput: "/all/marble-manifest-pipeline-test"
    }));
    new CfnParameter(this, 'AppConfigPathTest', {
      type: "String", default: AppConfigPathTest, description: "The path the keys for parameter store should be read and written to for test config."
    });

    // Next, we'll begin to define our resources 
    const codebuild_role = new Role(this, 'CodeBuildTrustRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com')});

    const S3Bucket =   new Bucket(this, 'S3Bucket', {
      versioned: true, removalPolicy: RemovalPolicy.Destroy
    });

    S3Bucket.addToResourcePolicy(new PolicyStatement()
            .addAnyPrincipal()
            .deny()
            .addActions('s3:*')
            .addCondition("Bool", {"aws:SecureTransport": false})
            .addResource(S3Bucket.bucketArn + '/*')); 

    const Pipeline_snsTopic = new sns.Topic(this, 'PipelineEventsTopic', {
      displayName: 'PipelineEventsTopic'
    }); Pipeline_snsTopic.subscribeEmail('PipelineEventsTopicSubscription',Fn.sub('${Receivers}'));

    codebuild_role.addToPolicy(new PolicyStatement()
                  .addResource(Fn.sub('arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/${AWS::StackName}-*'))
                  .addActions('logs:CreateLogGroup','logs:CreateLogStream','logs:PutLogEvents'));
    codebuild_role.addToPolicy(new PolicyStatement()
                  .addResource(S3Bucket.bucketArn)
                  .addActions('s3:GetObject','s3:PutObject'));

    const cloudformation_role = new Role(this, 'CloudFormationTrustRole', {
      assumedBy: new ServicePrincipal('cloudformation.amazonaws.com')});

    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResource(Fn.sub('arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:*'))
    .addActions('states:CreateStateMachine','states:DeleteStateMachine','states:TagResource'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:s3:::${TestStackName}*'),Fn.sub('arn:aws:s3:::${ProdStackName}*'))
    .addActions('s3:CreateBucket', 's3:DeleteBucket','s3:PutBucketLogging','s3:GetBucketCORS','s3:DeleteBucketPolicy',
                's3:PutBucketCORS','s3:PutBucketPolicy','s3:GetBucketPolicy','s3:PutBucketNotification'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResource(Fn.sub('arn:aws:s3:::${ResolvedBucketName}',{ResolvedBucketName: Fn.importValue(Fn.join(":",[InfrastructureStackName.toString(), "LogBucket"]))}))
    .addActions('s3:PutBucketAcl','s3:GetBucketAcl'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResource(S3Bucket.bucketArn + '/*')
    .addAction('s3:GetObject'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/${DataBrokerStackName}/*'),Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/${ImageServiceTestStackName}/*'),Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/${ImageServiceProdStackName}/*'))
    .addActions('ssm:GetParameter','ssm:GetParametersByPath','ssm:GetParameters'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/${TestStackName}/*'),Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/${ProdStackName}/*'),Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter${AppConfigPathProd}/*'),Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter${AppConfigPathTest}/*'))
    .addActions('ssm:DeleteParameter','ssm:DeleteParameters','ssm:PutParameter','ssm:AddTagsToResource'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${TestStackName}-*'),Fn.sub('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${ProdStackName}-*'))
    .addActions('lambda:*'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:iam::${AWS::AccountId}:role/${TestStackName}-*'),Fn.sub('arn:aws:iam::${AWS::AccountId}:role/${ProdStackName}-*'))
    .addActions('iam:GetRole','iam:CreateRole','iam:DeleteRole','iam:DeleteRolePolicy','iam:AttachRolePolicy','iam:DetachRolePolicy','iam:PutRolePolicy','iam:PassRole'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResource(Fn.sub('arn:aws:cloudformation:${AWS::Region}:aws:transform/Serverless-2016-10-31'))
    .addAction('cloudformation:CreateChangeSet'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addAllResources()
    .addActions('cloudfront:CreateDistribution','cloudfront:CreateCloudFrontOriginAccessIdentity',
                'cloudfront:DeleteDistribution','cloudfront:DeleteCloudFrontOriginAccessIdentity',
                'cloudfront:UpdateDistribution','cloudfront:UpdateCloudFrontOriginAccessIdentity',
                'cloudfront:GetDistribution','cloudfront:GetCloudFrontOriginAccessIdentity',
                'cloudfront:GetCloudFrontOriginAccessIdentityConfig','cloudfront:TagResource'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addResource(Fn.sub("arn:aws:route53:::hostedzone/${ResolvedZone}",{ResolvedZone: Fn.importValue(Fn.join(":",[DomainStackName.toString(), "Zone"]))}))
    .addActions('route53:ChangeResourceRecordSets','route53:ListResourceRecordSets'));
    cloudformation_role.addToPolicy(new PolicyStatement()
    .addAllResources()
    .addActions('route53:ListHostedZones','route53:GetChange'));

    const codepipeline_role = new Role(this, 'CodePipelineRole', {
      assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')});

    codepipeline_role.addToPolicy(new PolicyStatement()
    .addResource(Fn.sub('arn:aws:codebuild:${AWS::Region}:${AWS::AccountId}:project/${AWS::StackName}'))
    .addActions('codebuild:StartBuild','codebuild:BatchGetBuikld'));

    codepipeline_role.addToPolicy(new PolicyStatement()
    .addResources(Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/${TestStackName}/*'),Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/${ProdStackName}/*'))
    .addActions('cloudformation:DescribeStacks','cloudformation:DescribeChangeSet','cloudformation:CreateChangeSet',
                'cloudformation:ExecuteChangeSet','cloudformation:DeleteChangeSet'));

    codepipeline_role.addToPolicy(new PolicyStatement()
    .addResource(cloudformation_role.roleArn)
    .addAction('iam:PassRole'));

    codepipeline_role.addToPolicy(new PolicyStatement()
    .addResource(Pipeline_snsTopic.topicArn)
    .addActions('sns:Publish','sns:Subscribe'));

    codepipeline_role.addToPolicy(new PolicyStatement()
    .addResource(S3Bucket.bucketArn + '/*')
    .addActions('s3:GetObject','s3:GetObjectVersion','s3:GetObjectVersioning','s3:PutObject'));
    
    const project = new codebuild.PipelineProject(this, 'build', {
      timeout: 5,
      description: Fn.sub("Building stage for ${ProdStackName}"),
      buildSpec: {
        version: '0.2',
        phases: {
          install: {
            "commands": [
              "echo \"Ensure that the codebuild directory is executable\"",
              "chmod -R 755 ./scripts/codebuild/*",
              "export BLUEPRINTS_DIR=\"$CODEBUILD_SRC_DIR_ConfigSource\"",
              "./scripts/codebuild/install.sh"
            ]
          },
          pre_build: {
            "commands": [
              "./scripts/codebuild/pre_build.sh"
            ]
          },
          build: {
            "commands": [
              'echo "Hello, CodeBuild!"',
              "./scripts/codebuild/build.sh"
            ]
          },
          post_build: {
            "commands": [
            "./scripts/codebuild/post_build.sh",
            "echo \"{\n  \\\"Parameters\\\" : {\n    \\\"AppConfigPath\\\" : \\\"${AppConfigPathTest}\\\",\n    \\\"ImageSourceBucket\\\" : \\\"/all/stacks/${DataBrokerStackName}/publicbucket\\\",\n    \\\"ImageServerHostname\\\" : \\\"/all/stacks/${ImageServiceTestStackName}/hostname\\\",\n    \\\"HostnamePrefix\\\" : \\\"${TestHostnamePrefix}\\\",\n    \\\"DomainStackName\\\" : \\\"${DomainStackName}\\\",\n    \\\"CreateDNSRecord\\\" : \\\"${CreateDNSRecord}\\\",\n    \\\"InfrastructureStackName\\\" : \\\"${InfrastructureStackName}\\\"\n  },\n  \\\"Tags\\\" : {\n    \\\"Name\\\" : \\\"${TestStackName}\\\",\n    \\\"Contact\\\" : \\\"${Receivers}\\\",\n    \\\"Owner\\\" : \\\"Stack: ${StackName}\\\",\n    \\\"Description\\\" : \\\"Test data pipeline for IIIF Manifests.\\\"\n  }\n}\" > test-stack-configuration.json\n",
            "echo \"{\n  \\\"Parameters\\\" : {\n    \\\"AppConfigPath\\\" : \\\"${AppConfigPathProd}\\\",\n    \\\"ImageSourceBucket\\\" : \\\"/all/stacks/${DataBrokerStackName}/publicbucket\\\",\n    \\\"ImageServerHostname\\\" : \\\"/all/stacks/${ImageServiceProdStackName}/hostname\\\",\n    \\\"HostnamePrefix\\\" : \\\"${ProdHostnamePrefix}\\\",\n    \\\"DomainStackName\\\" : \\\"${DomainStackName}\\\",\n    \\\"CreateDNSRecord\\\" : \\\"${CreateDNSRecord}\\\",\n    \\\"InfrastructureStackName\\\" : \\\"${InfrastructureStackName}\\\"\n  },\n  \\\"Tags\\\" : {\n    \\\"Name\\\" : \\\"${ProdStackName}\\\",\n    \\\"Contact\\\" : \\\"${Receivers}\\\",\n    \\\"Owner\\\" : \\\"Stack: ${StackName}\\\",\n    \\\"Description\\\" : \\\"Production data pipeline for IIIF Manifests.\\\"\n  }\n}\" > prod-stack-configuration.json"]
          },       
        },
        artifacts: {
          files: [
            "output.yml",
            "test-stack-configuration.json",
            "prod-stack-configuration.json"
          ]
        }
      },
      environment: {
        buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_8_11_0, 
        environmentVariables: {
          "S3_BUCKET": {value:S3Bucket.bucketName},
          "AppConfigPathTest": {value: AppConfigPathTest},
          "AppConfigPathProd": {value: AppConfigPathProd},
          "DataBrokerStackName": {value: DataBrokerStackName},
          "ImageServiceTestStackName": {value: ImageServiceTestStackName},
          "ImageServiceProdStackName": {value: ImageServiceProdStackName},
          "TestHostnamePrefix": {value: TestHostnamePrefix},
          "ProdHostnamePrefix": {value: ProdHostnamePrefix},
          "DomainStackName": {value: DomainStackName},
          "CreateDNSRecord": {value: CreateDNSRecord},
          "InfrastructureStackName": {value: InfrastructureStackName},
          "TestStackName": {value: TestStackName},
          "ProdStackName": {value: ProdStackName},
          "Receivers": {value: Receivers},
          "StackName": {value: Fn.sub("${AWS::StackName}")}
          }
        }},);


    const app_source_action = new codepipeline.GitHubSourceAction({
      actionName: 'GitHub_App_Source', owner: GitHubUser.toString(), repo: ManifestPipelineRepoName.toString(), branch: ManifestPipelineRepoBranch.toString(),
      oauthToken: oAuth, outputArtifactName: 'AppCodeSource', pollForSourceChanges: true, runOrder: 1});
    const config_source_action = new codepipeline.GitHubSourceAction({
      actionName: 'GitHub_Config_Source', owner: GitHubUser.toString(), repo: ConfigurationRepoName.toString(), branch: ConfigurationRepoBranchName.toString(),
      oauthToken: oAuth, outputArtifactName: 'ConfigSource', pollForSourceChanges: true, runOrder: 1});

    const app_build_action = new codebuild.PipelineBuildAction({
      actionName: 'Build',
      project,
      inputArtifact: app_source_action.outputArtifact,
      additionalInputArtifacts: [config_source_action.outputArtifact],
      outputArtifactName: 'BuiltCode' 
    });

    const create_test_change_set = 
        new cfn.PipelineCreateReplaceChangeSetAction({
          actionName: 'CreateChangeSet',
          stackName: TestStackName.toString(),
          changeSetName: 'TestChangeSetName',
          templateConfiguration: app_build_action.outputArtifact.atPath('test-stack-configuration.json'),
          templatePath: app_build_action.outputArtifact.atPath('output.yml'),
          adminPermissions: true,
          runOrder: 1,
          deploymentRole: cloudformation_role,
          capabilities: CloudFormationCapabilities.NamedIAM, 
        });

    const execute_test_change_set = new cfn.PipelineExecuteChangeSetAction({
          actionName: 'ExecuteChangeSet',
          changeSetName: 'TestChangeSetName',
          stackName: TestStackName.toString(),
          // role: cloudformation_role,
          runOrder: 2
        });

    const test_environment_approval = new codepipeline.ManualApprovalAction({
          runOrder: 3,
          actionName: 'ManualApprovalOfTestEnvironment',
          notificationTopic: Pipeline_snsTopic,
          additionalInformation: 'Approval or Reject this change after running Exploratory Tests'
        });

    const create_prod_change_set = new cfn.PipelineCreateReplaceChangeSetAction({
          actionName: 'CreateChangeSet',
          stackName: ProdStackName.toString(),
          changeSetName: 'ProdChangeSetName',
          templateConfiguration: app_build_action.outputArtifact.atPath('prod-stack-configuration.json'),
          templatePath: app_build_action.outputArtifact.atPath('output.yml'),
          deploymentRole: cloudformation_role,
          adminPermissions: true,
          capabilities: CloudFormationCapabilities.NamedIAM,
          runOrder: 1
        });

        const execute_prod_change_set = new cfn.PipelineExecuteChangeSetAction({
          actionName: 'ExecuteChangeSet',
          changeSetName: 'ProdChangeSetName',
          stackName: ProdStackName.toString(),
          // role: cloudformation_role,
          runOrder: 2
        });

    new codepipeline.Pipeline(this, 'ManifestPipelinePipeline',{
      stages: [
        {
          name: 'Source',
          actions: [app_source_action, config_source_action],
        },
        {
          name: 'Build',
          actions: [app_build_action],
        },
        {
          name: 'DeployToTest',
          actions: [create_test_change_set, execute_test_change_set, test_environment_approval],
        },
        { 
          name: 'DeployToProd',
          actions: [create_prod_change_set, execute_prod_change_set],
         },
      ],
      artifactBucket: S3Bucket     
    });
    }
  }
