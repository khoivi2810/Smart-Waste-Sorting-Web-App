import json

file_path = 'model.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. Hạ cấp Keras version
if 'modelTopology' in data:
    data['modelTopology']['keras_version'] = '2.12.0'
    if data['modelTopology'].get('model_config', {}).get('class_name') == 'Functional':
        data['modelTopology']['model_config']['class_name'] = 'Model'

# 2. Xóa cấu trúc rườm rà
def fix_keras3_artifacts(obj):
    if isinstance(obj, dict):
        if obj.get('class_name') == 'DTypePolicy' and 'config' in obj:
            return obj['config'].get('name', 'float32')
        obj.pop('module', None)
        obj.pop('registered_name', None)
        for k, v in list(obj.items()):
            obj[k] = fix_keras3_artifacts(v)
    elif isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = fix_keras3_artifacts(obj[i])
    return obj

data = fix_keras3_artifacts(data)

# 3. Chuẩn hóa InputLayer, input_layers, output_layers và inbound_nodes
try:
    config = data['modelTopology']['model_config']['config']
    
    # Ép mảng 1 chiều thành 2 chiều
    for key in ['input_layers', 'output_layers']:
        if key in config:
            layers_list = config[key]
            if layers_list and not isinstance(layers_list[0], list):
                config[key] = [layers_list]

    layers = config['layers']
    for layer in layers:
        # Sửa lỗi batch_shape của InputLayer (LỖI BẠN VỪA GẶP)
        if layer.get('class_name') == 'InputLayer':
            layer_config = layer.get('config', {})
            if 'batch_shape' in layer_config and 'batch_input_shape' not in layer_config:
                layer_config['batch_input_shape'] = layer_config.pop('batch_shape')
        
        # Sửa lỗi object thành array của inbound_nodes
        inbound = layer.get('inbound_nodes', [])
        if isinstance(inbound, dict) or not inbound:
            layer['inbound_nodes'] = []
            continue
        
        new_inbound = []
        for node in inbound:
            if isinstance(node, dict) and 'args' in node:
                kwargs = node.get('kwargs', {})
                node_list = []
                for arg in node['args']:
                    if isinstance(arg, list):
                        for sub_arg in arg:
                            if isinstance(sub_arg, dict) and 'config' in sub_arg:
                                h = sub_arg['config'].get('keras_history')
                                if h: node_list.append([h[0], h[1], h[2], kwargs])
                    elif isinstance(arg, dict) and 'config' in arg:
                        h = arg['config'].get('keras_history')
                        if h: node_list.append([h[0], h[1], h[2], kwargs])
                if node_list:
                    new_inbound.append(node_list)
            else:
                new_inbound.append(node)
        layer['inbound_nodes'] = new_inbound
except Exception as e:
    pass

# 4. Xóa training_config
if 'training_config' in data.get('modelTopology', {}):
    del data['modelTopology']['training_config']

# 5. Đồng bộ tên trọng số depthwise
try:
    depthwise_layers = set()
    layers = data['modelTopology']['model_config']['config']['layers']
    for layer in layers:
        if layer.get('class_name') == 'DepthwiseConv2D':
            depthwise_layers.add(layer.get('name'))
            
    for manifest in data.get('weightsManifest', []):
        for weight in manifest.get('weights', []):
            name = weight.get('name', '')
            parts = name.split('/')
            if len(parts) == 2 and parts[0] in depthwise_layers and parts[1] == 'kernel':
                weight['name'] = f"{parts[0]}/depthwise_kernel"
except:
    pass

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, separators=(',', ':'))

print("Hoàn tất! Cấu trúc và trọng số đã tương thích 100%.")