.PHONY: all build clean install start transcript lint lint-fix lint-report

all: build

install: package.json
	npm install

build: install
	npx tsc
	chmod +x dist/cli-main.js

clean:
	rm -rf dist
	rm -rf node_modules

start: build
	node dist/cli-main.js

# Get transcript for a video
# Usage: make transcript ARGS="video_id1 video_id2 --languages en fr"
transcript: build
	node dist/cli-main.js $(ARGS)

# Lint the codebase
lint:
	npx eslint --ext .ts src/

# Fix automatically fixable linting issues
lint-fix:
	npx eslint --ext .ts src/ --fix

# Generate lint error report in JSON format
lint-report:
	npx eslint --ext .ts src/ --output-file eslint-report.json --format json