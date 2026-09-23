/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "url-shortener-v2",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const mongoUrl = new sst.Secret(
      "MongoUrl",
      "mongodb+srv://<username>:<password>@cluster0.mongodb.net/<",
    );
    const hashIdsSalt = new sst.Secret("HashIdsSalt", "<salt>");
    const hashIdsMinLength = new sst.Secret("HashIdsMinLength", "0");
    const port = new sst.Secret("Port", "8080");
    const baseUrl = new sst.Secret("BaseUrl", "http://localhost:8080");
    const nodeEnv = new sst.Secret("NodeEnv", "development");
    const mongoMaxPoolSize = new sst.Secret("MongoMaxPoolSize", "100");
    const vpc = new sst.aws.Vpc("MyVpc");
    const redis = new sst.aws.Redis("MyRedis", {
      vpc,
      cluster: {
        nodes: 1,
      },
    });
    const cluster = new sst.aws.Cluster("MyCluster", { vpc }); // ECS
    const service = new sst.aws.Service("MyService", {
      capacity: {
        fargate: {
          base: 1,
          weight: 1,
        },
        spot: {
          weight: 1,
        },
      },
      cluster,
      link: [
        redis,
        mongoUrl,
        hashIdsSalt,
        hashIdsMinLength,
        port,
        baseUrl,
        nodeEnv,
        mongoMaxPoolSize,
      ],
      loadBalancer: {
        domain: "bitly.fullstackclub.com.br", // route 53
        rules: [
          { listen: "80/http", forward: "8080/http" },
          { listen: "443/https", forward: "8080/http" },
        ],
      },
      dev: {
        command: "pnpm run dev",
      },
    });
  },
});
