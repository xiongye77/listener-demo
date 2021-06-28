const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'listener-demo',
  cdkDependencies: [
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-autoscaling',
    '@aws-cdk/aws-elasticloadbalancingv2',
  ],
});

const common_exclude = ['cdk.out', 'cdk.context.json', 'images', 'yarn-error.log', 'dependabot.yml'];
project.npmignore.exclude(...common_exclude);
project.gitignore.exclude(...common_exclude);

project.synth();

