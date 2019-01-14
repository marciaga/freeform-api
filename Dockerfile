FROM keymetrics/pm2:10-alpine as build

RUN apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers autoconf automake make nasm python git && \
  npm install --quiet node-gyp -g

WORKDIR /usr/app

ADD package.json /usr/app
ADD yarn.lock /usr/app

RUN yarn

RUN yarn global add pm2

COPY . /usr/app

RUN yarn build

FROM keymetrics/pm2:10-alpine

COPY --from=build /usr/app /usr/app

ENV NODE_ENV production

EXPOSE 8000

CMD ["pm2-runtime", "/usr/app/ecosystem.config.js"]
