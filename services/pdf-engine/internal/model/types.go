package model

// SignatureZone defines where the visual signature goes
type SignatureZone struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// SignatureAppearance configures visual stamp options
type SignatureAppearance struct {
	ShowName   bool `json:"showName"`
	ShowDate   bool `json:"showDate"`
	ShowReason bool `json:"showReason"`
}

// Command is the JSON-RPC request read from stdin.
// One JSON object per line — never batched.
type Command struct {
	Op          string   `json:"op"`
	InputPath   string   `json:"inputPath"`
	InputPathB  string   `json:"inputPathB,omitempty"` // compare: second input
	InputPaths  []string `json:"inputPaths,omitempty"` // merge: multiple inputs
	OutputPath  string   `json:"outputPath"`           // or OutputDir for split
	Password    string   `json:"password,omitempty"`

	// Split operations
	PageRanges  []string `json:"pageRanges,omitempty"`  // e.g., ["1-3", "5"]
	MergeOutput bool     `json:"mergeOutput,omitempty"` // true = trim to single file

	// Signing operations
	CertPath    string               `json:"certPath,omitempty"`
	Passphrase  string               `json:"passphrase,omitempty"`
	Page        int                  `json:"page,omitempty"`
	Zone        *SignatureZone       `json:"zone,omitempty"`
	Reason      string               `json:"reason,omitempty"`
	Location    string               `json:"location,omitempty"`
	Contact     string               `json:"contact,omitempty"`
	Appearance  *SignatureAppearance `json:"appearance,omitempty"`
}

// Response is the JSON-RPC result written to stdout.
type Response struct {
	Success    bool   `json:"success"`
	OutputPath string `json:"outputPath,omitempty"`
	Error      string `json:"error,omitempty"`
	Data       any    `json:"data,omitempty"` // Flexible data payload for certInfo, verify, etc.
}

