package shutdown

import "sync/atomic"

var isShuttingDown atomic.Bool

func IsShuttingDown() bool {
	return isShuttingDown.Load()
}

func SetShuttingDown(v bool) {
	isShuttingDown.Store(v)
}
