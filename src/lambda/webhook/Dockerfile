FROM node AS build
WORKDIR /app
COPY index.ts package.json tsconfig.json ./
RUN npm install && \
  npm run build

FROM amazon/aws-lambda-nodejs:14 AS production
COPY package*.json ./
COPY --from=build /app/index.js ./
RUN npm install --production
CMD [ "index.handler" ]
