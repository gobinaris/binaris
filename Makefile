SHELL := /bin/bash

.DEFAULT_GOAL = build

NO_CACHE = $(shell if [ $${NO_CACHE:-false} != false ]; then echo --no-cache; fi)
SUDO := $(shell if docker info 2>&1 | grep "permission denied" >/dev/null; then echo "sudo -E"; fi)
INTERACTIVE := $(shell if [ -t 0 ]; then echo "-it"; fi)
DOCKER := $(SUDO) docker
DOCKER_IMAGE := binaris/binaris

version := $(shell cat package.json | jq -r ".version")

define cli_envs
	-e BINARIS_LOG_LEVEL       \
	-e tag                     \
	-e BINARIS_API_KEY         \
	-e BINARIS_ACCOUNT_ID      \
	-e BINARIS_INVOKE_ENDPOINT \
	-e BINARIS_DEPLOY_ENDPOINT \
	-e BINARIS_LOG_ENDPOINT
endef

BRANCH := $(shell if [[ ! -z $${BRANCH_NAME+x} ]]; then echo $${BRANCH_NAME}; else git rev-parse --abbrev-ref HEAD 2>/dev/null || echo UNKNOWN; fi)

.PHONY: build
build: require-tag
		$(DOCKER) build $(NO_CACHE) -f binaris.Dockerfile -t $(DOCKER_IMAGE):$(tag) .

.PHONY: rebuild
rebuild: NO_CACHE=--no-cache
rebuild: build

.PHONY: tag
tag: require-tag
		$(DOCKER) tag $(DOCKER_IMAGE):$(tag) binaris
		$(DOCKER) tag $(DOCKER_IMAGE):$(tag) $(DOCKER_IMAGE):$(BRANCH)

.PHONY: just_lint lint
just_lint:
		$(DOCKER) run                                                 \
			--rm                                                      \
			$(DOCKER_IMAGE):$(tag)                                    \
			bash -c "cd /home/dockeruser/binaris && npm run lint"
ifeq ($(CI),true)
lint: just_lint
else
lint: build just_lint
endif

.PHONY: just_test test
just_test:
		export tag=$(tag)
		$(DOCKER) run                                     \
			$(INTERACTIVE)                                \
			--rm                                          \
			--privileged                                  \
			--user root                                   \
			-v /var/run/docker.sock:/var/run/docker.sock  \
			$(cli_envs) $(DOCKER_IMAGE):$(tag)            \
			bash -c 'cd /home/dockeruser/binaris && npm run test -- $(TEST_ARGS)'
ifeq ($(CI),true)
test: just_test
else
test: build just_test
endif

.PHONY: publish
publish: require-npm-creds require-npm-tag
		git tag $(version)
		git push origin $(version)
		export tag=$(tag)
		$(DOCKER) run                                                                                              \
			--rm                                                                                                     \
			$(DOCKER_IMAGE):$(tag)                                                                                   \
			bash -c 'cd /home/dockeruser/binaris && echo "//registry.npmjs.org/:_authToken=$(NPM_TOKEN)">~/.npmrc && \
				npm publish --tag $(NPM_TAG) &&                                                                                         \
				rm ~/.npmrc'

.PHONY: require-tag
require-tag:
	@if [ -z $${tag+x} ]; then echo 'tag' make variable must be defined; false; fi

.PHONY: require-npm-tag
require-npm-tag:
	@if [ -z $${NPM_TAG+x} ]; then echo 'NPM_TAG' make variable must be defined; false; fi

.PHONY: require-npm-creds
require-npm-creds:
	@if [ -z $${NPM_TOKEN+x} ]; then echo 'NPM_TOKEN' make variable must be defined; false; fi

.PHONY: all
all: lint test

.PHONY: bn
bn:
	$(DOCKER) build -t binaris/bn .
