import React from 'react';
import PropTypes from 'prop-types';
// Material UI
import Dialog from 'material-ui/Dialog';
import TextField from 'material-ui/TextField';
import { Tabs, Tab } from 'material-ui/Tabs';
import Paper from 'material-ui/Paper';
import { List } from 'material-ui/List';
import FlatButton from 'material-ui/FlatButton';
import { Toolbar, ToolbarGroup } from 'material-ui/Toolbar';
import Subheader from 'material-ui/Subheader';

// Styles
import styles from './chef.css';
import sharedStyles from '../../shared/styles.css';
// Misc
import _ from 'lodash';
import update from 'immutability-helper';
import ItemPicker from '../../shared/ItemPicker/ItemPicker.jsx'
import { callVaultApi, tokenHasCapabilities, history } from '../../shared/VaultUtils.jsx';
import ItemList from '../../shared/ItemList/ItemList.jsx';

function snackBarMessage(message) {
    document.dispatchEvent(new CustomEvent('snackbar', { detail: { message: message } }));
}

export default class ChefAuthBackend extends React.Component {
    static propTypes = {
        params: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired
    };

    backendConfigSchema = {
        organization: '',
        base_url: undefined,
        max_ttl: undefined,
        ttl: undefined
    }

    itemConfigSchema = {
        id: '',
        policies: []
    }

    constructor(props) {
        super(props);
        this.state = {
            baseUrl: `/auth/chef/${this.props.params.namespace}/`,
            baseVaultPath: `auth/${this.props.params.namespace}`,
            roles: [],
            hosts: [],
            config: this.backendConfigSchema,
            newConfig: this.backendConfigSchema,
            itemConfig: this.teamConfigSchema,
            selectedItemId: '',
            newItemId: '',
            isBackendConfigured: false,
            openItemDialog: false,
            selectedTab: 'roles',
            deleteUserPath: ''
        };

        _.bindAll(
            this,
            'listChefRoles',
            'listChefHosts',
            'getOrgConfig',
            'displayItem'
        );
    }

    listChefRoles() {
        tokenHasCapabilities(['list'], `${this.state.baseVaultPath}/map/roles`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/map/roles`, { list: true }, null)
                    .then((resp) => {
                        let roles = _.get(resp, 'data.data.keys', []);
                        this.setState({ roles: _.valuesIn(roles) });
                    })
                    .catch((error) => {
                        if (error.response.status !== 404) {
                            snackBarMessage(error);
                        } else {
                            this.setState({ roles: [] });
                        }
                    });
            })
            .catch(() => {
                snackBarMessage(new Error('Access denied'));
            })
    }

    listChefHosts() {
        tokenHasCapabilities(['list'], `${this.state.baseVaultPath}/map/hosts`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/map/hosts`, { list: true }, null)
                    .then((resp) => {
                        let hosts = _.get(resp, 'data.data.keys', []);
                        this.setState({ hosts: _.valuesIn(hosts) });
                    })
                    .catch((error) => {
                        if (error.response.status !== 404) {
                            snackBarMessage(error);
                        } else {
                            this.setState({ hosts: [] });
                        }
                    });
            })
            .catch(() => {
                snackBarMessage(new Error('Access denied'));
            })
    }

    getOrgConfig() {
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/config`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/config`, null, null)
                    .then((resp) => {
                        let config = _.get(resp, 'data.data', this.backendConfigSchema);
                        if (!config.chef_server) {
                            history.push(`${this.state.baseUrl}backend`);
                            this.setState({ selectedTab: 'backend', isBackendConfigured: false, newConfig: this.backendConfigSchema });
                            snackBarMessage(new Error(`This backend has not yet been configured`));
                        } else {
                            this.setState({
                                config: config,
                                newConfig: config,
                                isBackendConfigured: true
                            });
                        }
                    })
                    .catch((error) => {
                        if (error.response.status !== 404) {
                            snackBarMessage(error);
                        } else {
                            error.message = `This backend has not yet been configured`;
                            history.push(`${this.state.baseUrl}backend`);
                            snackBarMessage(error);
                        }
                    });
            })
            .catch(() => {
                snackBarMessage(new Error('Access denied'));
            })
    }

    displayItem() {
        let itemId = this.state.selectedTab;
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/map/${this.state.selectedItemId}`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/map/${this.state.selectedItemId}`, null, null, null)
                    .then((resp) => {
                        let item = _.get(resp, 'data.data', {});
                        item.id = itemId;

                        let policies = _.get(item, 'policy', undefined);
                        item.policies = policies ? policies.split(',') : [];

                        this.setState({ itemConfig: item, openItemDialog: true });
                    })
                    .catch(snackBarMessage)
            })
            .catch(() => {
                this.setState({ selectedItemId: '' })
                snackBarMessage(new Error(`No permissions to display properties for ${itemId} ${this.state.selectedItemId}`));
            })
    }

    createUpdateConfig() {
        callVaultApi('post', `${this.state.baseVaultPath}/config`, null, this.state.newConfig)
            .then(() => {
                snackBarMessage(`Backend ${this.state.baseVaultPath}/config has been updated`);
                this.setState({ isBackendConfigured: this.state.newConfig.organization, config: this.state.newConfig });
            })
            .catch(snackBarMessage);
    }

    createUpdateItem(id) {
        tokenHasCapabilities(['create', 'update'], `${this.state.baseVaultPath}/map/${id}`)
            .then(() => {
                let updateObj = _.clone(this.state.itemConfig);
                updateObj.policy = this.state.itemConfig.policies.join(',');
                callVaultApi('post', `${this.state.baseVaultPath}/map/${id}`, null, updateObj)
                    .then(() => {
                        snackBarMessage(`Chef ${this.state.selectedTab.substring(0, this.state.selectedTab.length - 1)} ${id.split('/')[1]} has been updated`);
                        this.listChefRoles();
                        this.listChefHosts();
                        this.setState({ openItemDialog: false, openNewItemDialog: false, itemConfig: _.clone(this.itemConfigSchema), selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    })
                    .catch(snackBarMessage);
            })
            .catch(() => {
                this.setState({ selectedRoleId: '' })
                snackBarMessage(new Error(`No permissions to display properties for role ${id}`));
            })
    }
    componentWillMount() {
        let tab = this.props.location.pathname.split(this.state.baseUrl)[1];
        if (!tab) {
            history.push(`${this.state.baseUrl}${this.state.selectedTab}/`);
        } else {
            this.setState({ selectedTab: tab.includes('/') ? tab.split('/')[0] : tab });
        }
    }

    componentDidMount() {
        this.listChefRoles();
        this.listChefHosts();
        this.getOrgConfig();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.selectedItemId !== prevState.selectedItemId) {
            this.listChefRoles();
            this.listChefHosts();
            if (this.state.selectedItemId) {
                let params = this.state.selectedItemId.split('/');
                if (params.length > 0) {
                    this.setState({ selectedTab: params[0] });
                    if (params.length > 1 && params[1]) {
                        this.displayItem();
                    }
                }
            }
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!_.isEqual(this.props.params.namespace, nextProps.params.namespace)) {
            // Reset
            this.setState({
                baseUrl: `/auth/chef/${nextProps.params.namespace}/`,
                baseVaultPath: `auth/${nextProps.params.namespace}`,
                hosts: [],
                roles: [],
                selectedItemId: '',
                newConfig: this.backendConfigSchema,
                config: this.backendConfigSchema,
                selectedTab: 'roles',
                isBackendConfigured: false
            }, () => {
                history.push(`${this.state.baseUrl}roles`);
                this.listChefRoles();
                this.listChefHosts();
                this.getOrgConfig();
            });
        }
    }

    render() {
        let renderPolicyDialog = () => {
            const actions = [
                <FlatButton
                    label='Cancel'
                    onTouchTap={() => {
                        this.setState({ openItemDialog: false, selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label='Save'
                    primary={true}
                    onTouchTap={() => {
                        this.createUpdateItem(this.state.selectedItemId);
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Editing Chef ${this.state.selectedTab.substring(0, this.state.selectedTab.length - 1)} '${this.state.selectedItemId}'`}
                    modal={false}
                    actions={actions}
                    open={this.state.openItemDialog}
                    onRequestClose={() => {
                        this.setState({ openItemDialog: false, selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <Subheader>Assigned Policies</Subheader>
                        <ItemPicker
                            height='250px'
                            selectedPolicies={this.state.itemConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ itemConfig: update(this.state.itemConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        };

        let renderNewPolicyDialog = () => {
            const actions = [
                <FlatButton
                    label='Cancel'
                    onTouchTap={() => {
                        this.setState({ openNewItemDialog: false, newItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label='Save'
                    primary={true}
                    onTouchTap={() => {
                        this.createUpdateItem(`${this.state.selectedTab}/${this.state.newItemId}`);
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Adding new ${this.state.selectedTab}`}
                    modal={false}
                    actions={actions}
                    open={this.state.openNewItemDialog}
                    onRequestClose={() => {
                        this.setState({ openNewItemDialog: false, newItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <TextField
                            className={styles.textFieldStyle}
                            hintText='Enter the new name'
                            floatingLabelFixed={true}
                            floatingLabelText='Name'
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newItemId: e.target.value });
                            }}
                        />
                        <Subheader>Assigned Policies</Subheader>
                        <ItemPicker
                            height='250px'
                            selectedPolicies={this.state.itemConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ itemConfig: update(this.state.itemConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        };

        return (
            <div>
                {this.state.openItemDialog && renderPolicyDialog()}
                {this.state.openNewItemDialog && renderNewPolicyDialog()}
                <Tabs
                    onChange={(e) => {
                        history.push(`${this.state.baseUrl}${e}/`);
                        this.setState({ newConfig: _.clone(this.state.config) });
                    }}
                    value={this.state.selectedTab}
                >
                    <Tab
                        label='Manage Roles'
                        value='roles'
                        onActive={() => {
                            this.setState({ selectedTab: 'roles' });
                        }}
                        disabled={!this.state.isBackendConfigured}
                    >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure Chef roles.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <Toolbar>
                                <ToolbarGroup firstChild={true}>
                                    <FlatButton
                                        primary={true}
                                        label='NEW ROLE'
                                        onTouchTap={() => {
                                            this.setState({
                                                newItemId: '',
                                                openNewItemDialog: true,
                                                itemConfig: _.clone(this.itemConfigSchema)
                                            })
                                        }}
                                    />
                                </ToolbarGroup>
                            </Toolbar>
                            <ItemList
                                itemList={this.state.roles}
                                itemUri={`${this.state.baseVaultPath}/map/roles`}
                                onDeleteTap={(deletedItem) => {
                                    snackBarMessage(`Chef role '${deletedItem}' deleted`);
                                    this.listChefRoles();
                                }}
                                onTouchTap={(item) => {
                                    tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/roles/${item}`)
                                        .then(() => {
                                            this.setState({ selectedItemId: `roles/${item}` });
                                            history.push(`${this.state.baseUrl}roles/${item}`);
                                        }).catch(() => {
                                            snackBarMessage(new Error('Access denied'));
                                        });

                                }}
                            />
                        </Paper>
                    </Tab>
                    <Tab
                        label='Manage Hosts'
                        value='hosts'
                        onActive={() => {
                            this.setState({ selectedTab: 'hosts' });
                        }}
                        disabled={!this.state.isBackendConfigured}
                    >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure Chef hosts.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <Toolbar>
                                <ToolbarGroup firstChild={true}>
                                    <FlatButton
                                        primary={true}
                                        label='NEW HOST'
                                        onTouchTap={() => {
                                            this.setState({
                                                newItemId: '',
                                                openNewItemDialog: true,
                                                itemConfig: _.clone(this.itemConfigSchema)
                                            })
                                        }}
                                    />
                                </ToolbarGroup>
                            </Toolbar>
                            <ItemList
                                itemList={this.state.hosts}
                                itemUri={`${this.state.baseVaultPath}/map/hosts`}
                                onDeleteTap={(deletedItem) => {
                                    snackBarMessage(`Chef role '${deletedItem}' deleted`);
                                    this.listChefHosts();
                                }}
                                onTouchTap={(item) => {
                                    tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/hosts/${item}`)
                                        .then(() => {
                                            this.setState({ selectedItemId: `hosts/${item}` });
                                            history.push(`${this.state.baseUrl}hosts/${item}`);
                                        }).catch(() => {
                                            snackBarMessage(new Error('Access denied'));
                                        });

                                }}
                            />
                        </Paper>
                    </Tab>
                    <Tab
                        label='Configure Backend'
                        value='backend'
                        onActive={() => this.setState({ selectedTab: 'backend' })}
                    >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure details to your Chef server.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <List>
                                <TextField
                                    hintText='https://devchef-vx-1.devintermedia.net/organizations/intermedia/'
                                    floatingLabelText='Chef server'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.chef_server}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { chef_server: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='1800000'
                                    floatingLabelText='TTL'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.ttl}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { ttl: { $set: e.target.value } }) });
                                    }}
                                />
                                <div style={{ paddingTop: '20px', textAlign: 'center' }}>
                                    <FlatButton
                                        primary={true}
                                        label='Save'
                                        onTouchTap={() => this.createUpdateConfig()}
                                    />
                                </div>
                            </List>
                        </Paper>
                    </Tab>
                </Tabs>
            </div >
        );
    }
}
