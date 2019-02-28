# Development
Prequisites: 
`yarn`
`node` >= 10.x.x

Clone the repo and `cd` into it, then run
```
$ yarn
```

Obtain a copy of the `.env` file

Connection to the staging database requires your IP to be whitelisted, so contact a developer who can provide access.

# Deploy

Build the Docker image locally 
```
$ docker build -t freeform-api .
```

Tag the image before pushing to AWS ECR
```
$ docker tag freeform-api:latest 248536655549.dkr.ecr.us-west-2.amazonaws.com/freeform-api:latest
```

Log in to ECR
```
$ aws ecr get-login --no-include-email
```

A docker command to use to login is returned. Copy and past the command to log in.

Push to ECR
```
$ docker push 248536655549.dkr.ecr.us-west-2.amazonaws.com/freeform-api:latest
```

If you get an error about your authorization token, it's likely you have multiple profiles in your `~/.aws/credentials` file. Use a profile that specifies the correct region: `us-west-2`.
```
$ aws ecr get-login --no-include-email --region us-west-2 --profile your_profile
```

