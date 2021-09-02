FROM node AS build
WORKDIR /app
COPY index.ts package.json tsconfig.json ./
RUN npm install --only=dev && \
  npm run build

FROM amazon/aws-lambda-nodejs:14
COPY package*.json ./
COPY --from=build /app/index.js ./
RUN npm install

CMD [ "index.handler" ]
