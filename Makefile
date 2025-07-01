dev-kernel:
	cd kernel && go run main.go --wd=../app/ --mode=dev --port=6808

dev-front:
	cd app && pnpm run dev

dev-electron:
	cd app && pnpm run start --no-sandbox

install-app:
	cd app && pnpm build:app
	rm -rf /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/app-bak
	mv /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/app /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/app-bak
	cp -r /root/projects/siyuan/app/stage/build/app /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/app

install-desktop:
	cd app && pnpm build:desktop
	rm -rf /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/desktop-bak
	mv /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/desktop /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/desktop-bak
	cp -r /root/projects/siyuan/app/stage/build/desktop /mnt/c/Users/InEas/AppData/Local/Programs/SiYuan/resources/stage/build/desktop

install:
	make install-app
	make install-desktop
	curl -G "http://100.74.82.128:6253/push" --data-urlencode "message=SiYuan Build Success"

pull:
	git pull --all
