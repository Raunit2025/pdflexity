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

// RedactionMark defines a region to redact in PDF point coordinates
type RedactionMark struct {
	Page       int     `json:"page"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	FillColor  string  `json:"fillColor,omitempty"`
	Label      string  `json:"label,omitempty"`
	LabelColor string  `json:"labelColor,omitempty"`
}

// PageDim describes a single page's dimensions in PDF points
type PageDim struct {
	Page   int     `json:"page"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// RedactionInfoResponse for /info endpoint
type RedactionInfoResponse struct {
	PageCount int        `json:"pageCount"`
	Pages     []PageDim `json:"pages"`
}

// SearchMatch represents a found text instance with its bounding box
type SearchMatch struct {
	Page   int     `json:"page"`
	Text   string  `json:"text"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// SearchResponse for /search endpoint
type SearchResponse struct {
	Matches []SearchMatch `json:"matches"`
	Total   int           `json:"total"`
}

// PreviewResponse for /preview endpoint
type PreviewResponse struct {
	ImageBase64 string `json:"imageBase64"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
}

// RedactionResult for successful redact operation
type RedactionResult struct {
	MarksApplied   int   `json:"marksApplied"`
	PagesAffected  []int `json:"pagesAffected"`
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

	// Redaction operations
	Marks         []RedactionMark `json:"marks,omitempty"`
	Query         string          `json:"query,omitempty"`
	CaseSensitive bool            `json:"caseSensitive,omitempty"`
	Regex         bool            `json:"regex,omitempty"`
	Scale         float64         `json:"scale,omitempty"`
}

// Response is the JSON-RPC result written to stdout.
type Response struct {
	Success    bool   `json:"success"`
	OutputPath string `json:"outputPath,omitempty"`
	Error      string `json:"error,omitempty"`
	Data       any    `json:"data,omitempty"` // Flexible data payload for certInfo, verify, etc.
}
