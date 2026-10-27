import os
from pathlib import Path
import truststore
truststore.inject_into_ssl()
from huggingface_hub import snapshot_download
root=Path(__file__).resolve().parents[1]
folder=root/'models'/'faster-whisper-small'
snapshot_download('Systran/faster-whisper-small',local_dir=str(folder),allow_patterns=['config.json','model.bin','tokenizer.json','vocabulary.*','preprocessor_config.json'])
print('Downloaded multilingual small model to project models directory.')
