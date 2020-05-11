# Changelog

All notable changes to this project will be documented in this file.

## [0.1.28] - 2020-05-11

- Fixes co-operatility issue with REST

## [0.1.25] - 2020-05-04

- Added options to support dataloader configuration

## [0.1.23] - 2020-04-11

- Now resolve NestDataLoader using `.resolve` rather than `.get` to support custom loader implementations which are not singletons (single instance scope).
