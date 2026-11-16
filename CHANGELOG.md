# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-16

### Added
- **Client** `fobDocuments({ api_key, api_secret, api_url? })` with `documents.list`, `getAll`, `get`, `findBySha256`, `upload`, `update` and `download`, for documents.finopsbricks.com's `/api/v1/documents`.
- **CLI** `fob-documents documents list|show|upload|edit|download`, `config add|list|use|current|remove` and `getting-started`. Every read takes `--json`.
