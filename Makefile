dev-kernel:
	cd kernel && go run main.go --wd=../app/ --mode=dev --port=6808

dev-front:
	cd app && pnpm run dev

dev-electron:
	cd app && pnpm run start --no-sandbox
