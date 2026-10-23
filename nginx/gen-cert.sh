#!/bin/bash
cd "$(dirname "$0")/certs" || exit 1
VM_IP=$(hostname -I | awk '{print $1}')
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout server.key -out server.crt \
  -subj "/C=VN/ST=ThaiNguyen/L=ThaiNguyen/O=MovieBooking/CN=movie.local" \
  -addext "subjectAltName=DNS:localhost,DNS:movie.local,IP:127.0.0.1,IP:${VM_IP}"
chmod 644 server.key server.crt
echo "Da tao server.crt va server.key (IP: ${VM_IP})"
