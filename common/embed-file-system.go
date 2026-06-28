package common

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/static"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e *embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	if err != nil {
		return false
	}
	return true
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	if name == "/" {
		// This will make sure the index page goes to NoRouter handler,
		// which will use the replaced index bytes with analytic codes.
		return nil, os.ErrNotExist
	}
	return e.FileSystem.Open(name)
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}

// themeAwareFileSystem delegates to the appropriate embedded FS based on
// the current theme (via GetTheme). This enables runtime theme switching
// without restarting the server.
type themeAwareFileSystem struct {
	defaultFS static.ServeFileSystem
	classicFS static.ServeFileSystem
}

func (t *themeAwareFileSystem) activeFS() static.ServeFileSystem {
	if GetTheme() == "classic" {
		return t.classicFS
	}
	return t.defaultFS
}

func (t *themeAwareFileSystem) Exists(prefix string, path string) bool {
	activeFS := t.activeFS()
	if activeFS.Exists(prefix, path) {
		return true
	}
	if activeFS != t.defaultFS {
		return t.defaultFS.Exists(prefix, path)
	}
	return false
}

func (t *themeAwareFileSystem) Open(name string) (http.File, error) {
	activeFS := t.activeFS()
	file, err := activeFS.Open(name)
	if err == nil || activeFS == t.defaultFS {
		return file, err
	}
	return t.defaultFS.Open(name)
}

// IsDefaultThemeHomePath reports whether the path should be served by the
// default-theme SPA (Landing page at /home).
func IsDefaultThemeHomePath(path string) bool {
	return path == "/home" || strings.HasPrefix(path, "/home/")
}

func NewThemeAwareFS(defaultFS, classicFS static.ServeFileSystem) static.ServeFileSystem {
	return &themeAwareFileSystem{defaultFS: defaultFS, classicFS: classicFS}
}
