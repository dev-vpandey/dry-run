#!/bin/sh
# Every package in package-lock.json must come from the public registry. A private proxy host
# (for example a company mirror) makes `npm ci` hang on GitHub's servers. Run from the repo root.
if grep '"resolved"' package-lock.json | grep -v '"https://registry.npmjs.org/'; then
  echo "package-lock.json: a package is not from https://registry.npmjs.org/. Run: npm install --registry=https://registry.npmjs.org/ and replace the proxy host in the lockfile." 1>&2
  exit 1
fi
