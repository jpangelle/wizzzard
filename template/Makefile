APP_NAME = __APP_NAME__
MODULE = __MODULE_NAME__
BUNDLE_ID = __BUNDLE_ID__
APP = dist/$(MODULE).app

build:
	swift build -c release
	rm -rf $(APP)
	mkdir -p $(APP)/Contents/MacOS $(APP)/Contents/Resources
	cp .build/release/$(MODULE) $(APP)/Contents/MacOS/$(MODULE)
	cp Resources/Info.plist $(APP)/Contents/Info.plist
	cp Resources/AppIcon.icns $(APP)/Contents/Resources/AppIcon.icns
	codesign --force --sign - --identifier $(BUNDLE_ID) $(APP)

run: build
	open $(APP)

install: build
	rm -rf "/Applications/$(APP_NAME).app"
	cp -R $(APP) "/Applications/$(APP_NAME).app"

clean:
	rm -rf .build dist

.PHONY: build run install clean
