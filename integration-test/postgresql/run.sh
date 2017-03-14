#!/bin/sh -e

trap teardown EXIT

setup() {
	  psql -f setup.sql
}

teardown() {
	  psql -f teardown.sql
}

npm install

setup
$(npm bin)/jest ./no-auth.test.ts
teardown

#setup
#$(npm bin)/jest ./auth.test.ts
