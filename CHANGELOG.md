# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.26] - 2020-05-11

- Fixes co-operatility issue with REST

## [0.1.25] - 2020-05-04

- Added options to support dataloader configuration

## [0.1.23] - 2020-04-11

- Now resolve NestDataLoader using `.resolve` rather than `.get` to support custom loader implementations which are not singletons (single instance scope).
