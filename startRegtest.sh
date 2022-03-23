#!/bin/bash

container_name='boltz-elements'

echo "Creating container"
docker run -d -v `pwd`/docker/:/home/elements/.elements --name $container_name -p 18884:18884 ghcr.io/vulpemventures/elements:latest

sleep 1

echo ""
echo "Creating wallet"
docker exec $container_name elements-cli createwallet default

sleep 1

echo ""
echo "Genrate 1 block"
addr=`docker exec $container_name elements-cli getnewaddress`
docker exec $container_name elements-cli generatetoaddress 1 $addr

sleep 1
echo ""
echo "Rescan the chain"
docker exec $container_name elements-cli rescanblockchain