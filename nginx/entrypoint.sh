#!/bin/sh
# Replace the literal placeholder REAL_HOST_VALUE with the actual env var.
# Using sed avoids any risk of envsubst touching nginx's own $variables.
sed "s|REAL_HOST_VALUE|${REAL_HOST}|g" \
    /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

# Validate config before starting
nginx -t && nginx -g 'daemon off;'
