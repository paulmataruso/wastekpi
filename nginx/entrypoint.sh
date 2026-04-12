#!/bin/sh
envsubst '${REAL_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -g 'daemon off;'
