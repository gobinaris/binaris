ifeq ($(tag),)
  $(error `tag` variable is required)
endif

SHELL := /bin/bash

.DEFAULT_GOAL = build

NO_CACHE = $(shell if [ $${NO_CACHE:-false} != false ]; then echo --no-cache; fi)
SUDO := $(shell if docker info 2>&1 | grep "permission denied" >/dev/null; then echo "sudo -E"; fi)
DOCKER := $(SUDO) docker
DOCKER_IMAGE := binaris

define cli_envs
	-e BINARIS_INVOKE_ENDPOINT \
	-e BINARIS_DEPLOY_ENDPOINT \
	-e BINARIS_LOG_ENDPOINT
endef

.PHONY: build
build:
		$(DOCKER) build $(NO_CACHE) -f binaris.Dockerfile -t $(DOCKER_IMAGE):$(tag) .

.PHONY: lint
lint: build
		$(DOCKER) run            \
			--rm                   \
			$(DOCKER_IMAGE):$(tag) \
			bash -c "cd /home/dockeruser/binaris && npm run lint"

.PHONY: test
test: build
		$(DOCKER) run                                   \
			--rm                                          \
			--privileged                                  \
			-v /var/run/docker.sock:/var/run/docker.sock  \
			$(cli_envs) $(DOCKER_IMAGE):$(tag)            \
			bash -c "cd /home/dockeruser/binaris && npm run test"

.PHONY: all
all: lint test
