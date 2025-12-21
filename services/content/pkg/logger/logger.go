package logger

import (
	"log/slog"
	"os"
)

var Log *slog.Logger

func Init() {
	Log = slog.New(slog.NewJSONHandler(os.Stdout, nil))
}

func Info(msg string, args ...any) {
	Log.Info(msg, args...)
}

func Error(msg string, args ...any) {
	Log.Error(msg, args...)
}