import * as asg from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';


export interface Ex2AppProps {
  readonly vpc?: ec2.IVpc;
}

// create EC2 in the default VPC with ALB
export class Ec2App extends cdk.Construct {
  readonly vpc: ec2.IVpc;
  readonly listener: elbv2.ApplicationListener;
  constructor(scope: cdk.Construct, id: string, props: Ex2AppProps = {}) {
    super(scope, id);

    this.vpc = props.vpc ?? getOrCreateVpc(this);

    const myasg = new asg.AutoScalingGroup(this, 'ASG', {
      vpc: this.vpc,
      instanceType: new ec2.InstanceType('t3.large'),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: this.vpc,
      internetFacing: true,
    });
    const listener = new elbv2.ApplicationListener(this, 'Listener', {
      loadBalancer,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });
    listener.addTargets('ASGTG', {
      port: 80,
      targets: [myasg],
    });
    this.listener = listener;
  }
}

export interface EcsAppProps {
  readonly vpc: ec2.IVpc;
  readonly listener: elbv2.ApplicationListener;
}

export class EcsApp extends cdk.Construct {
  readonly listener: elbv2.ApplicationListener;
  constructor(scope: cdk.Construct, id: string, props: EcsAppProps) {
    super(scope, id);

    this.listener = props.listener;

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
    });

    const task = new ecs.FargateTaskDefinition(this, 'Task', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    task.addContainer('nginx', {
      image: ecs.ContainerImage.fromRegistry('nginx'),
      portMappings: [
        {
          containerPort: 80,
        },
      ],
    });

    const svc = new ecs.FargateService(this, 'FargateService', {
      cluster,
      taskDefinition: task,
    });

    this.listener.addTargets('EcsService', {
      targets: [svc],
      port: 80,
    });
  }
}


const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();

const stack = new cdk.Stack(app, 'my-stack-dev', { env: devEnv });

const ec2app = new Ec2App(stack, 'Ec2App');
new EcsApp(stack, 'EcsApp', {
  vpc: ec2app.vpc,
  listener: ec2app.listener,
});

app.synth();


function getOrCreateVpc(scope: cdk.Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1'
    || process.env.CDK_USE_DEFAULT_VPC === '1' ? ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}

