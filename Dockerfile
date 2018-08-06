FROM node:8.4.0-alpine

MAINTAINER Harish Anchu <harishanchu@gmail.com>

#RUN apk --update add nmap bash

ADD start.sh /start.sh
RUN chmod +x /start.sh

RUN npm install -g pm2

ADD . /app
WORKDIR /app
RUN npm install --production
EXPOSE 3000

CMD ["/start.sh"]
